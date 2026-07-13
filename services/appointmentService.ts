import { listBusyIntervals, createEvent, deleteEvent } from "@/services/calendar";
import { refreshAccessToken } from "@/services/googleOAuth";
import { getBusinessById, getEffectiveCalendarId, getEffectiveTimezone, getEffectiveWorkingHours } from "@/services/business";
import { parseRequestedAppointment } from "@/services/automation/appointmentParser";
import { createAppointment, updateAppointment, getAppointment, getFutureAppointmentsForContact, createNotification } from "@/services/db";
import { logLeadActivity } from "@/services/activityService";
import { sendEmail } from "@/services/gmail";
import { isContactSuppressed } from "@/services/suppression";
import { createUnsubscribeToken } from "@/lib/auth";
import { buildAbsoluteUrl } from "@/lib/url";
import { buildComplianceFooter } from "@/services/emailTemplates/complianceFooter";
import { buildAppointmentRequestedContent } from "@/services/emailTemplates/appointmentRequested";
import { buildAppointmentConfirmedContent } from "@/services/emailTemplates/appointmentConfirmed";
import { APPOINTMENT_REMINDER_SUBJECT } from "@/services/emailTemplates/appointmentReminder";
import { decrypt } from "@/lib/crypto";
import { zonedDateTimeToUtc, formatZonedDateTime } from "@/lib/date";
import { logAction } from "@/lib/logger";
import type { Appointment, Business, Lead } from "@/types";

/**
 * Domain logic for the Appointment lifecycle's requested/approved stages —
 * see CLAUDE.md's Appointments section. Replaces the old
 * services/appointmentBooking.ts: every parsed booking request now becomes a
 * durable `appointments` row in `requested` status, full stop — the old
 * autoBookAppointments instant-book bypass is retired, since a wrong detail
 * at booking time is costly enough that approval is no longer optional.
 * Calendar events created here never invite the customer as an attendee —
 * Calendar is a display/scheduling layer for the owner only; the customer's
 * only confirmation is the email this file sends on approval.
 */

const MAX_ALTERNATES = 2;
const MAX_SCAN_DAYS = 5;
const SLOT_STEP_MINUTES = 30;

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Every candidate slot start, in order, across the scan window — business hours only, in SLOT_STEP_MINUTES increments. */
function buildCandidateSlots(scanFrom: Date, timezone: string, workingHours: { start: number; end: number }): Date[] {
  const slots: Date[] = [];
  for (let dayOffset = 0; dayOffset < MAX_SCAN_DAYS; dayOffset++) {
    const day = new Date(scanFrom.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateStr = day.toLocaleDateString("en-CA", { timeZone: timezone });
    for (let minutes = workingHours.start * 60; minutes < workingHours.end * 60; minutes += SLOT_STEP_MINUTES) {
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const slotUtc = zonedDateTimeToUtc(`${dateStr}T${hh}:${mm}:00`, timezone);
      if (slotUtc.getTime() > scanFrom.getTime()) {
        slots.push(slotUtc);
      }
    }
  }
  return slots;
}

async function buildUnsubscribeFooter(business: Business, appHost: string, email: string): Promise<string> {
  const token = await createUnsubscribeToken({ businessId: business.id, email });
  const unsubscribeUrl = buildAbsoluteUrl(appHost, `/api/unsubscribe/${token}`);
  return buildComplianceFooter(business, unsubscribeUrl);
}

export type AppointmentRequestOutcome =
  | { type: "none" }
  | { type: "requested"; label: string }
  | { type: "alternates"; labels: string[] };

/**
 * Parses a lead's message for a requested date/time and, if found and the
 * slot is free, creates a durable `appointments` row in `requested` status
 * (never auto-booked) and sends the instant, no-lock-implied pending-ack
 * email. If the slot conflicts, offers up to MAX_ALTERNATES nearby open
 * times in the ack instead (no Appointment row — nothing's fixed yet, same
 * as before). Returns `{ type: "none" }` if nothing was requested,
 * Gmail/Calendar isn't connected, or anything fails — best-effort, never
 * throws; the caller (services/leadService.ts) falls back to the plain
 * acknowledgment template in every "none" case.
 */
export async function createAppointmentFromLead(business: Business, lead: Lead, appHost: string): Promise<AppointmentRequestOutcome> {
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    return { type: "none" };
  }

  const timezone = getEffectiveTimezone(business);
  const requested = await parseRequestedAppointment(lead, timezone);
  if (!requested.requested || !requested.dateTime) {
    return { type: "none" };
  }

  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    const calendarId = getEffectiveCalendarId(business);
    const workingHours = getEffectiveWorkingHours(business);
    const durationMs = requested.durationMinutes * 60_000;

    const requestedStartUtc = zonedDateTimeToUtc(requested.dateTime, timezone);
    const now = new Date();
    const scanFrom = requestedStartUtc.getTime() < now.getTime() ? now : requestedStartUtc;
    const scanWindowEnd = new Date(scanFrom.getTime() + MAX_SCAN_DAYS * 24 * 60 * 60 * 1000);

    const busy = await listBusyIntervals({
      accessToken,
      calendarId,
      timeMin: scanFrom.toISOString(),
      timeMax: scanWindowEnd.toISOString(),
    });
    const busyIntervals = busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
    const isFree = (startUtc: Date) => {
      const startMs = startUtc.getTime();
      const endMs = startMs + durationMs;
      return !busyIntervals.some((b) => overlaps(startMs, endMs, b.start, b.end));
    };

    const requestedLocalHour = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(requestedStartUtc)
    );
    const withinBusinessHours = requestedLocalHour >= workingHours.start && requestedLocalHour < workingHours.end;
    const isFuture = requestedStartUtc.getTime() > now.getTime();

    if (isFuture && withinBusinessHours && isFree(requestedStartUtc)) {
      const scheduledEnd = new Date(requestedStartUtc.getTime() + durationMs);
      const appointment = await createAppointment(business.id, {
        leadId: lead.id,
        customerName: lead.name,
        customerEmail: lead.email,
        customerPhone: lead.phone,
        serviceType: lead.requestedService,
        scheduledStart: requestedStartUtc.toISOString(),
        scheduledEnd: scheduledEnd.toISOString(),
        sourceMessage: lead.message,
      });
      const label = formatZonedDateTime(requestedStartUtc, timezone);

      await logLeadActivity(business.id, lead.id, "lead.appointment_requested", `Customer requested an appointment for ${label} — review and approve.`);
      try {
        await createNotification(business.id, {
          leadId: lead.id,
          type: "lead.appointment_requested",
          message: `${lead.name} requested an appointment for ${label} — approve to confirm.`,
        });
      } catch (error) {
        logAction("appointment.request-notify-failed", {
          businessId: business.id,
          appointmentId: appointment.id,
          error: error instanceof Error ? error.message : "unknown error",
        });
      }

      // The Appointment row is created either way — the owner still needs to
      // see and approve the request — but the instant auto-send itself is
      // suppression-gated, same as the review-request/rebook-reminder jobs.
      if (!(await isContactSuppressed(business.id, lead.email))) {
        const footer = await buildUnsubscribeFooter(business, appHost, lead.email);
        const content = buildAppointmentRequestedContent(appointment, business, label, footer);
        await sendEmail({
          refreshToken: decrypt(business.googleRefreshTokenEnc),
          fromEmail: business.googleConnectedEmail,
          to: lead.email,
          subject: content.subject,
          body: content.body,
        });
      }

      return { type: "requested", label };
    }

    const alternates: Date[] = [];
    for (const candidate of buildCandidateSlots(scanFrom, timezone, workingHours)) {
      if (isFree(candidate)) {
        alternates.push(candidate);
        if (alternates.length >= MAX_ALTERNATES) break;
      }
    }

    if (alternates.length === 0) {
      return { type: "none" };
    }
    return { type: "alternates", labels: alternates.map((a) => formatZonedDateTime(a, timezone)) };
  } catch (error) {
    logAction("appointment.request-failed", {
      businessId: business.id,
      leadId: lead.leadId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { type: "none" };
  }
}

export interface ApproveAppointmentInput {
  price?: number | null;
  location?: string | null;
  prepInstructions?: string | null;
  scheduledStart?: string;
  scheduledEnd?: string;
}

export type ApproveAppointmentResult = { ok: true; appointment: Appointment } | { ok: false; error: string };

/** Only these current statuses may transition — exported so tests can exercise the guard without a live DB. */
export function canApprove(appointment: Pick<Appointment, "status">): boolean {
  return appointment.status === "requested";
}
export function canFlagOutcome(appointment: Pick<Appointment, "status">): boolean {
  return appointment.status === "approved";
}

/**
 * Approves a requested appointment: creates the Calendar event on the
 * business's own calendar FIRST (no customer attendee), and only on success
 * marks the appointment `approved` and sends the confirmation email — a
 * Calendar failure is surfaced as a clear error, never silently swallowed,
 * and the appointment stays `requested` so the owner can retry.
 */
export async function approveAppointment(
  businessId: string,
  id: string,
  input: ApproveAppointmentInput,
  appHost: string
): Promise<ApproveAppointmentResult> {
  const [appointment, business] = await Promise.all([getAppointment(businessId, id), getBusinessById(businessId)]);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  if (!canApprove(appointment)) {
    return { ok: false, error: `Appointment must be Requested before approving (currently ${appointment.status}).` };
  }
  if (!business) {
    return { ok: false, error: "Business not found." };
  }
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    return { ok: false, error: "Google isn't connected for this business — connect it in Settings before approving appointments." };
  }

  const scheduledStart = input.scheduledStart ?? appointment.scheduledStart;
  const scheduledEnd = input.scheduledEnd ?? appointment.scheduledEnd;
  const timezone = getEffectiveTimezone(business);

  let eventId: string;
  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    eventId = await createEvent({
      accessToken,
      calendarId: getEffectiveCalendarId(business),
      summary: `Appointment: ${appointment.customerName}${appointment.serviceType ? ` (${appointment.serviceType})` : ""}`,
      description: [
        `Customer: ${appointment.customerName} <${appointment.customerEmail}>`,
        appointment.customerPhone ? `Phone: ${appointment.customerPhone}` : null,
        appointment.sourceMessage ? `Original request: "${appointment.sourceMessage}"` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      startDateTime: scheduledStart.slice(0, 19),
      endDateTime: scheduledEnd.slice(0, 19),
      timeZone: "UTC",
      // Deliberately no attendeeEmails/notifyAttendees — Calendar is a
      // display/scheduling layer for the owner only, never customer-facing.
    });
  } catch (error) {
    logAction("appointment.approve-calendar-failed", {
      businessId,
      appointmentId: id,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return { ok: false, error: "Couldn't create the Calendar event — the appointment hasn't been approved. Check your Google connection and try again." };
  }

  const updated = await updateAppointment(businessId, id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    googleCalendarEventId: eventId,
    price: input.price ?? null,
    location: input.location ?? null,
    prepInstructions: input.prepInstructions ?? null,
    scheduledStart,
    scheduledEnd,
  });

  if (appointment.leadId) {
    await logLeadActivity(businessId, appointment.leadId, "lead.appointment_approved", `Appointment approved for ${formatZonedDateTime(new Date(scheduledStart), timezone)}.`);
  }

  try {
    const footer = await buildUnsubscribeFooter(business, appHost, appointment.customerEmail);
    const label = formatZonedDateTime(new Date(scheduledStart), timezone);
    const content = buildAppointmentConfirmedContent(updated, business, label, footer);
    await sendEmail({
      refreshToken: decrypt(business.googleRefreshTokenEnc),
      fromEmail: business.googleConnectedEmail,
      to: appointment.customerEmail,
      subject: content.subject,
      body: content.body,
    });
  } catch (error) {
    logAction("appointment.confirmation-send-failed", {
      businessId,
      appointmentId: id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }

  return { ok: true, appointment: updated };
}

export type FlagOutcomeResult = { ok: true; appointment: Appointment } | { ok: false; error: string };

async function flagOutcome(businessId: string, id: string, status: "no_show" | "cancelled"): Promise<FlagOutcomeResult> {
  const appointment = await getAppointment(businessId, id);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  if (!canFlagOutcome(appointment)) {
    return { ok: false, error: `Appointment must be Approved before it can be flagged ${status === "no_show" ? "no-show" : "cancelled"} (currently ${appointment.status}).` };
  }

  // Best-effort — an owner flagging no-show/cancelled shouldn't be blocked by a stale Calendar event that's already gone.
  if (appointment.googleCalendarEventId) {
    try {
      const business = await getBusinessById(businessId);
      if (business?.googleRefreshTokenEnc) {
        const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
        await deleteEvent({ accessToken, calendarId: getEffectiveCalendarId(business), eventId: appointment.googleCalendarEventId });
      }
    } catch (error) {
      logAction("appointment.flag-calendar-cleanup-failed", { businessId, appointmentId: id, error: error instanceof Error ? error.message : "unknown error" });
    }
  }

  const updated = await updateAppointment(businessId, id, { status });
  if (appointment.leadId) {
    await logLeadActivity(businessId, appointment.leadId, status === "no_show" ? "lead.appointment_no_show" : "lead.appointment_cancelled", status === "no_show" ? "Appointment marked as a no-show." : "Appointment cancelled.");
  }
  return { ok: true, appointment: updated };
}

export async function flagNoShow(businessId: string, id: string): Promise<FlagOutcomeResult> {
  return flagOutcome(businessId, id, "no_show");
}

export async function flagCancelled(businessId: string, id: string): Promise<FlagOutcomeResult> {
  return flagOutcome(businessId, id, "cancelled");
}

/** The old "Dismiss" action on a requested (not yet approved) appointment — the owner decided not to book it. */
export async function dismissRequestedAppointment(businessId: string, id: string): Promise<FlagOutcomeResult> {
  const appointment = await getAppointment(businessId, id);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  if (!canApprove(appointment)) {
    return { ok: false, error: `Only a Requested appointment can be dismissed (currently ${appointment.status}).` };
  }
  const updated = await updateAppointment(businessId, id, { status: "cancelled" });
  if (appointment.leadId) {
    await logLeadActivity(businessId, appointment.leadId, "lead.appointment_dismissed", "Appointment request dismissed.");
  }
  return { ok: true, appointment: updated };
}

export type ReminderActionResult = { ok: true; appointment: Appointment } | { ok: false; error: string };

/**
 * The pre-appointment reminder's own approve/edit/skip/send lifecycle —
 * distinct from and not auto-sent like the review-request/rebook-reminder
 * jobs in services/appointmentLifecycle.ts (see that file's
 * runAppointmentReminderDraftJob, which only ever sets reminderStatus to
 * 'pending'). Mirrors services/followupSender.ts's Approve/Edit/Skip/Send
 * shape for the Estimate Follow-up Queue, scoped to Appointments instead.
 */
export function canActOnReminder(appointment: Pick<Appointment, "reminderStatus">): boolean {
  return appointment.reminderStatus === "pending" || appointment.reminderStatus === "approved" || appointment.reminderStatus === "failed";
}

export async function approveReminder(businessId: string, id: string): Promise<ReminderActionResult> {
  const appointment = await getAppointment(businessId, id);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.reminderStatus !== "pending") {
    return { ok: false, error: `Reminder must be drafted before approving (currently ${appointment.reminderStatus ?? "not drafted"}).` };
  }
  const updated = await updateAppointment(businessId, id, { reminderStatus: "approved" });
  return { ok: true, appointment: updated };
}

export async function editReminderMessage(businessId: string, id: string, message: string): Promise<ReminderActionResult> {
  const appointment = await getAppointment(businessId, id);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  const updated = await updateAppointment(businessId, id, { reminderMessage: message });
  return { ok: true, appointment: updated };
}

export async function skipReminder(businessId: string, id: string): Promise<ReminderActionResult> {
  const appointment = await getAppointment(businessId, id);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  const updated = await updateAppointment(businessId, id, { reminderStatus: "skipped" });
  return { ok: true, appointment: updated };
}

const REMINDER_SEND_MAX_ATTEMPTS = 2; // one send + one retry, same as services/followupSender.ts

/**
 * The only path that actually emails the reminder — requires it to already
 * be 'approved' (or 'failed', for a retry). Not suppression-gated, same
 * precedent as the appointment confirmation email: a human is explicitly
 * choosing to send about a specific already-approved booking, not an
 * automated broadcast. Still gets the CASL compliance footer + a fresh
 * unsubscribe token.
 */
export async function sendReminder(businessId: string, id: string, appHost: string): Promise<ReminderActionResult> {
  const [appointment, business] = await Promise.all([getAppointment(businessId, id), getBusinessById(businessId)]);
  if (!appointment) {
    return { ok: false, error: "Appointment not found." };
  }
  if (appointment.reminderStatus !== "approved" && appointment.reminderStatus !== "failed") {
    return { ok: false, error: `Reminder must be Approved before sending (currently ${appointment.reminderStatus ?? "not drafted"}).` };
  }
  if (!appointment.reminderMessage) {
    return { ok: false, error: "No reminder message to send." };
  }
  if (!business) {
    return { ok: false, error: "Business not found." };
  }
  if (!business.googleRefreshTokenEnc || !business.googleConnectedEmail) {
    return { ok: false, error: "Google isn't connected for this business." };
  }

  const footer = await buildUnsubscribeFooter(business, appHost, appointment.customerEmail);
  const body = `${appointment.reminderMessage}\n\n${footer}`;

  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= REMINDER_SEND_MAX_ATTEMPTS; attempt++) {
    try {
      await sendEmail({
        refreshToken: decrypt(business.googleRefreshTokenEnc),
        fromEmail: business.googleConnectedEmail,
        to: appointment.customerEmail,
        subject: APPOINTMENT_REMINDER_SUBJECT,
        body,
      });
      const updated = await updateAppointment(businessId, id, { reminderStatus: "sent", reminderSentAt: new Date().toISOString() });
      logAction("appointment.reminder-send.success", { businessId, appointmentId: id, attempt });
      return { ok: true, appointment: updated };
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown error";
      logAction("appointment.reminder-send.attempt-failed", { businessId, appointmentId: id, attempt, error: lastError });
    }
  }

  await updateAppointment(businessId, id, { reminderStatus: "failed" });
  logAction("appointment.reminder-send.failed", { businessId, appointmentId: id, error: lastError });
  return { ok: false, error: lastError };
}

/** Re-exported for services/appointmentLifecycle.ts's rebook-reminder eligibility check. */
export { getFutureAppointmentsForContact };
