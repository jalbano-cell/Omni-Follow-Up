import { getAppointments, updateAppointment, getFutureAppointmentsForContact } from "@/services/db";
import { getEffectiveRebookIntervalDays } from "@/services/business";
import { isContactSuppressed } from "@/services/suppression";
import { sendEmail } from "@/services/gmail";
import { createUnsubscribeToken } from "@/lib/auth";
import { buildAbsoluteUrl } from "@/lib/url";
import { buildComplianceFooter } from "@/services/emailTemplates/complianceFooter";
import { buildAppointmentReviewRequestContent } from "@/services/emailTemplates/appointmentReviewRequest";
import { buildAppointmentRebookReminderContent } from "@/services/emailTemplates/appointmentRebookReminder";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import type { Appointment, Business } from "@/types";

/**
 * The daily, idempotent appointment lifecycle — three jobs piggybacked onto
 * the same cron invocation as the follow-up/reply-sync/Gmail-lead-capture
 * jobs (app/api/follow-ups/generate/route.ts), same Vercel Hobby-plan
 * cron-schedule constraint as those. The Appointment row's own timestamps
 * are the source of truth for every transition here — Google Calendar is
 * never read back, since an owner renaming/moving/deleting an event must
 * never cause a ghost send or a missed one. Every send sets its `*_sent_at`
 * guard regardless of outcome (best-effort, no retry — same philosophy as
 * every other automated send in this app), so re-running this job never
 * double-sends.
 */

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface AppointmentLifecycleLog {
  timestamp: string;
  businessId: string;
  processed: number;
  errors: string[];
}

/** Pure — an approved appointment whose scheduled_end has passed is done, unless the owner already flagged it no_show/cancelled (those are separate terminal statuses this never touches). */
export function isEligibleForCompletion(appointment: Pick<Appointment, "status" | "scheduledEnd">, now: Date): boolean {
  return appointment.status === "approved" && new Date(appointment.scheduledEnd).getTime() <= now.getTime();
}

/** Pure — one day after a completed appointment, once, unless suppressed. */
export function isEligibleForReviewRequest(
  appointment: Pick<Appointment, "status" | "scheduledEnd" | "reviewRequestSentAt">,
  now: Date,
  isSuppressed: boolean
): boolean {
  if (appointment.status !== "completed" || appointment.reviewRequestSentAt || isSuppressed) return false;
  return now.getTime() - new Date(appointment.scheduledEnd).getTime() >= ONE_DAY_MS;
}

/** Pure — `intervalDays` days after completion, once, unless disabled, suppressed, or the customer already has a future appointment (never nag someone already back on the calendar). */
export function isEligibleForRebookReminder(
  appointment: Pick<Appointment, "status" | "completedAt" | "rebookReminderSentAt">,
  now: Date,
  intervalDays: number | null,
  isSuppressed: boolean,
  hasFutureAppointment: boolean
): boolean {
  if (intervalDays == null || appointment.status !== "completed" || appointment.rebookReminderSentAt || isSuppressed || hasFutureAppointment) {
    return false;
  }
  if (!appointment.completedAt) return false;
  const dueAt = new Date(appointment.completedAt).getTime() + intervalDays * ONE_DAY_MS;
  return dueAt <= now.getTime();
}

/** Auto-transitions approved appointments whose scheduled_end has passed to completed. No email — see the review-request/rebook jobs below for what fires once completed. */
export async function runAppointmentCompletionJob(businesses: Business[]): Promise<AppointmentLifecycleLog[]> {
  const logs: AppointmentLifecycleLog[] = [];
  const now = new Date();

  for (const business of businesses) {
    const timestamp = now.toISOString();
    let processed = 0;
    const errors: string[] = [];
    try {
      const appointments = await getAppointments(business.id);
      for (const appointment of appointments) {
        if (!isEligibleForCompletion(appointment, now)) continue;
        try {
          await updateAppointment(business.id, appointment.id, { status: "completed", completedAt: now.toISOString() });
          processed += 1;
        } catch (error) {
          errors.push(`appointment ${appointment.id}: ${error instanceof Error ? error.message : "unknown error"}`);
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown error");
    }
    logAction("appointment-lifecycle.completion", { businessId: business.id, processed, errors });
    logs.push({ timestamp, businessId: business.id, processed, errors });
  }

  return logs;
}

/** Auto-sends the day-after review request — skipped (logged, not an error) for a business with no googleReviewUrl set, since there's nowhere to send the customer. */
export async function runAppointmentReviewRequestJob(businesses: Business[], appHost: string): Promise<AppointmentLifecycleLog[]> {
  const logs: AppointmentLifecycleLog[] = [];
  const now = new Date();

  for (const business of businesses) {
    const timestamp = now.toISOString();
    let processed = 0;
    const errors: string[] = [];
    try {
      if (business.googleReviewUrl && business.googleRefreshTokenEnc && business.googleConnectedEmail) {
        const appointments = await getAppointments(business.id);
        for (const appointment of appointments) {
          try {
            const suppressed = await isContactSuppressed(business.id, appointment.customerEmail);
            if (!isEligibleForReviewRequest(appointment, now, suppressed)) continue;

            const token = await createUnsubscribeToken({ businessId: business.id, email: appointment.customerEmail });
            const footer = buildComplianceFooter(business, buildAbsoluteUrl(appHost, `/api/unsubscribe/${token}`));
            const content = buildAppointmentReviewRequestContent(appointment, business, footer);
            try {
              await sendEmail({
                refreshToken: decrypt(business.googleRefreshTokenEnc),
                fromEmail: business.googleConnectedEmail,
                to: appointment.customerEmail,
                subject: content.subject,
                body: content.body,
              });
            } catch (error) {
              logAction("appointment-lifecycle.review-request-send-failed", {
                businessId: business.id,
                appointmentId: appointment.id,
                error: error instanceof Error ? error.message : "unknown error",
              });
            }
            // Set regardless of send outcome — best-effort, no-retry, same as every other automated send in this app.
            await updateAppointment(business.id, appointment.id, { reviewRequestSentAt: now.toISOString() });
            processed += 1;
          } catch (error) {
            errors.push(`appointment ${appointment.id}: ${error instanceof Error ? error.message : "unknown error"}`);
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown error");
    }
    logAction("appointment-lifecycle.review-request", { businessId: business.id, processed, errors });
    logs.push({ timestamp, businessId: business.id, processed, errors });
  }

  return logs;
}

/** Auto-sends the recurring rebook reminder, per services/business.ts's getEffectiveRebookIntervalDays (business default, per-service override). */
export async function runAppointmentRebookReminderJob(businesses: Business[], appHost: string): Promise<AppointmentLifecycleLog[]> {
  const logs: AppointmentLifecycleLog[] = [];
  const now = new Date();

  for (const business of businesses) {
    const timestamp = now.toISOString();
    let processed = 0;
    const errors: string[] = [];
    try {
      if (business.googleRefreshTokenEnc && business.googleConnectedEmail) {
        const appointments = await getAppointments(business.id);
        for (const appointment of appointments) {
          try {
            const intervalDays = getEffectiveRebookIntervalDays(business, appointment.serviceType);
            const [suppressed, futureAppointments] = await Promise.all([
              isContactSuppressed(business.id, appointment.customerEmail),
              getFutureAppointmentsForContact(business.id, appointment.customerEmail, appointment.id),
            ]);
            if (!isEligibleForRebookReminder(appointment, now, intervalDays, suppressed, futureAppointments.length > 0)) continue;

            const token = await createUnsubscribeToken({ businessId: business.id, email: appointment.customerEmail });
            const footer = buildComplianceFooter(business, buildAbsoluteUrl(appHost, `/api/unsubscribe/${token}`));
            const content = buildAppointmentRebookReminderContent(appointment, business, footer);
            try {
              await sendEmail({
                refreshToken: decrypt(business.googleRefreshTokenEnc),
                fromEmail: business.googleConnectedEmail,
                to: appointment.customerEmail,
                subject: content.subject,
                body: content.body,
              });
            } catch (error) {
              logAction("appointment-lifecycle.rebook-reminder-send-failed", {
                businessId: business.id,
                appointmentId: appointment.id,
                error: error instanceof Error ? error.message : "unknown error",
              });
            }
            await updateAppointment(business.id, appointment.id, { rebookReminderSentAt: now.toISOString() });
            processed += 1;
          } catch (error) {
            errors.push(`appointment ${appointment.id}: ${error instanceof Error ? error.message : "unknown error"}`);
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "unknown error");
    }
    logAction("appointment-lifecycle.rebook-reminder", { businessId: business.id, processed, errors });
    logs.push({ timestamp, businessId: business.id, processed, errors });
  }

  return logs;
}
