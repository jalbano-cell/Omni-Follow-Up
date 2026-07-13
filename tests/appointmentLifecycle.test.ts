import { describe, it, expect } from "vitest";
import {
  isEligibleForCompletion,
  isEligibleForReviewRequest,
  isEligibleForRebookReminder,
  isEligibleForReminderDraft,
} from "@/services/appointmentLifecycle";
import { getEffectiveRebookIntervalDays } from "@/services/business";

const NOW = new Date("2026-07-15T12:00:00Z");
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

describe("isEligibleForCompletion", () => {
  it("completes an approved appointment whose scheduled_end has passed", () => {
    expect(isEligibleForCompletion({ status: "approved", scheduledEnd: "2026-07-15T11:00:00Z" }, NOW)).toBe(true);
  });

  it("does not complete an approved appointment still in the future", () => {
    expect(isEligibleForCompletion({ status: "approved", scheduledEnd: "2026-07-15T13:00:00Z" }, NOW)).toBe(false);
  });

  it("does not touch a requested appointment", () => {
    expect(isEligibleForCompletion({ status: "requested", scheduledEnd: "2026-07-15T11:00:00Z" }, NOW)).toBe(false);
  });

  it("does not re-complete an already-completed appointment", () => {
    expect(isEligibleForCompletion({ status: "completed", scheduledEnd: "2026-07-15T11:00:00Z" }, NOW)).toBe(false);
  });
});

describe("isEligibleForReviewRequest", () => {
  const completedYesterday = {
    status: "completed" as const,
    scheduledEnd: new Date(NOW.getTime() - ONE_DAY_MS).toISOString(),
    reviewRequestSentAt: null,
  };

  it("sends the day after a completed appointment", () => {
    expect(isEligibleForReviewRequest(completedYesterday, NOW, false)).toBe(true);
  });

  it("does not send less than a day after completion", () => {
    const recentlyCompleted = { ...completedYesterday, scheduledEnd: new Date(NOW.getTime() - 1000).toISOString() };
    expect(isEligibleForReviewRequest(recentlyCompleted, NOW, false)).toBe(false);
  });

  it("never sends twice", () => {
    const alreadySent = { ...completedYesterday, reviewRequestSentAt: "2026-07-15T00:00:00Z" };
    expect(isEligibleForReviewRequest(alreadySent, NOW, false)).toBe(false);
  });

  it("is suppressed for an unsubscribed contact", () => {
    expect(isEligibleForReviewRequest(completedYesterday, NOW, true)).toBe(false);
  });

  it("does not fire for a no_show or cancelled appointment", () => {
    expect(isEligibleForReviewRequest({ ...completedYesterday, status: "no_show" }, NOW, false)).toBe(false);
    expect(isEligibleForReviewRequest({ ...completedYesterday, status: "cancelled" }, NOW, false)).toBe(false);
  });
});

describe("isEligibleForRebookReminder", () => {
  const completed50DaysAgo = {
    status: "completed" as const,
    completedAt: new Date(NOW.getTime() - 50 * ONE_DAY_MS).toISOString(),
    rebookReminderSentAt: null,
  };

  it("sends once the interval has elapsed", () => {
    expect(isEligibleForRebookReminder(completed50DaysAgo, NOW, 49, false, false)).toBe(true);
  });

  it("does not send before the interval elapses", () => {
    expect(isEligibleForRebookReminder(completed50DaysAgo, NOW, 60, false, false)).toBe(false);
  });

  it("is disabled when intervalDays is null", () => {
    expect(isEligibleForRebookReminder(completed50DaysAgo, NOW, null, false, false)).toBe(false);
  });

  it("never sends twice", () => {
    const alreadySent = { ...completed50DaysAgo, rebookReminderSentAt: "2026-07-01T00:00:00Z" };
    expect(isEligibleForRebookReminder(alreadySent, NOW, 49, false, false)).toBe(false);
  });

  it("is suppressed for an unsubscribed contact", () => {
    expect(isEligibleForRebookReminder(completed50DaysAgo, NOW, 49, true, false)).toBe(false);
  });

  it("never nags a customer who already has a future appointment", () => {
    expect(isEligibleForRebookReminder(completed50DaysAgo, NOW, 49, false, true)).toBe(false);
  });

  it("does not fire for a no_show or cancelled appointment", () => {
    expect(isEligibleForRebookReminder({ ...completed50DaysAgo, status: "no_show" }, NOW, 49, false, false)).toBe(false);
    expect(isEligibleForRebookReminder({ ...completed50DaysAgo, status: "cancelled" }, NOW, 49, false, false)).toBe(false);
  });
});

describe("getEffectiveRebookIntervalDays", () => {
  it("falls back to the business default when no override exists", () => {
    expect(getEffectiveRebookIntervalDays({ rebookIntervalDays: 49, rebookIntervalOverrides: {} }, "Grooming")).toBe(49);
  });

  it("prefers a per-service override over the business default", () => {
    expect(
      getEffectiveRebookIntervalDays({ rebookIntervalDays: 49, rebookIntervalOverrides: { grooming: 30 } }, "Grooming")
    ).toBe(30);
  });

  it("treats an explicit null override as disabled even with a business default set", () => {
    expect(
      getEffectiveRebookIntervalDays({ rebookIntervalDays: 49, rebookIntervalOverrides: { consultation: null } }, "Consultation")
    ).toBeNull();
  });

  it("is disabled when neither a default nor an override is set", () => {
    expect(getEffectiveRebookIntervalDays({ rebookIntervalDays: null, rebookIntervalOverrides: {} }, "Grooming")).toBeNull();
  });

  it("matches service type case-insensitively", () => {
    expect(
      getEffectiveRebookIntervalDays({ rebookIntervalDays: null, rebookIntervalOverrides: { grooming: 49 } }, "GROOMING")
    ).toBe(49);
  });
});

describe("isEligibleForReminderDraft", () => {
  const approvedTomorrow2pm = {
    status: "approved" as const,
    scheduledStart: new Date(NOW.getTime() + 20 * 60 * 60 * 1000).toISOString(),
    reminderStatus: null,
  };

  it("drafts once the appointment enters the reminder window", () => {
    expect(isEligibleForReminderDraft(approvedTomorrow2pm, NOW, 24)).toBe(true);
  });

  it("does not draft before the reminder window is reached", () => {
    expect(isEligibleForReminderDraft(approvedTomorrow2pm, NOW, 1)).toBe(false);
  });

  it("never re-drafts once a reminder already exists (any non-null status)", () => {
    expect(isEligibleForReminderDraft({ ...approvedTomorrow2pm, reminderStatus: "pending" }, NOW, 24)).toBe(false);
    expect(isEligibleForReminderDraft({ ...approvedTomorrow2pm, reminderStatus: "sent" }, NOW, 24)).toBe(false);
  });

  it("does not draft for a requested (not yet approved) appointment", () => {
    expect(isEligibleForReminderDraft({ ...approvedTomorrow2pm, status: "requested" }, NOW, 24)).toBe(false);
  });

  it("does not draft once the appointment has already started", () => {
    const alreadyStarted = { ...approvedTomorrow2pm, scheduledStart: new Date(NOW.getTime() - 60 * 1000).toISOString() };
    expect(isEligibleForReminderDraft(alreadyStarted, NOW, 24)).toBe(false);
  });
});
