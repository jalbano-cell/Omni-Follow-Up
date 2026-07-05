import { createEvent, deleteEvent } from "@/services/calendar";
import { refreshAccessToken } from "@/services/googleOAuth";
import { updateFollowUp } from "@/services/db";
import { getEffectiveCalendarId, getEffectiveTimezone, getEffectiveWorkingHours } from "@/services/business";
import { decrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";
import { CALENDAR_REMINDER_DURATION_MINUTES } from "@/config/constants";
import type { Business, Estimate, FollowUp } from "@/types";

function reminderTimeRange(dateIso: string, reminderHour: number): { start: string; end: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const startHour = pad(reminderHour);
  const endMinutes = CALENDAR_REMINDER_DURATION_MINUTES;
  return {
    start: `${dateIso}T${startHour}:00:00`,
    end: `${dateIso}T${pad(reminderHour + Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}:00`,
  };
}

/**
 * Creates a Calendar reminder for a freshly-drafted follow-up, nudging the
 * business owner to go review/approve/send it. Output-only — never reads
 * availability, never books anything. Best-effort: any failure (not
 * connected, API error) is logged and swallowed so a Calendar problem can
 * never block follow-up drafting, which is the actual point of this run.
 */
export async function ensureReminderForDraft(business: Business, followUp: FollowUp, estimate: Estimate): Promise<void> {
  if (followUp.calendarEventId || !business.googleRefreshTokenEnc) {
    return;
  }

  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    const { start, end } = reminderTimeRange(followUp.scheduledDate, getEffectiveWorkingHours(business).start);
    const eventId = await createEvent({
      accessToken,
      calendarId: getEffectiveCalendarId(business),
      summary: `Follow up with ${estimate.customerName}`,
      description: `${estimate.serviceType} estimate (${estimate.estimateValue}) is due for a follow-up. Review and send it from the Follow-up Queue in OmniFollowUp.`,
      startDateTime: start,
      endDateTime: end,
      timeZone: getEffectiveTimezone(business),
    });
    await updateFollowUp(business.id, followUp.id, { calendarEventId: eventId });
  } catch (error) {
    logAction("calendar.reminder-create-failed", {
      businessId: business.id,
      followUpId: followUp.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}

/**
 * Deletes a follow-up's reminder once it's been resolved (sent or skipped).
 * Best-effort, same rationale as ensureReminderForDraft — a Calendar
 * failure must never block the send/skip action itself.
 */
export async function clearReminder(business: Business, followUp: FollowUp): Promise<void> {
  if (!followUp.calendarEventId || !business.googleRefreshTokenEnc) {
    return;
  }

  try {
    const accessToken = await refreshAccessToken(decrypt(business.googleRefreshTokenEnc));
    await deleteEvent({
      accessToken,
      calendarId: getEffectiveCalendarId(business),
      eventId: followUp.calendarEventId,
    });
    await updateFollowUp(business.id, followUp.id, { calendarEventId: null });
  } catch (error) {
    logAction("calendar.reminder-clear-failed", {
      businessId: business.id,
      followUpId: followUp.id,
      error: error instanceof Error ? error.message : "unknown error",
    });
  }
}
