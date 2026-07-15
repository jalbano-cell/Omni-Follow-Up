import type { Lead, NewLeadInput } from "@/types";

/** A repeat customer contacting the business again next month is a new inquiry, not a duplicate of an old one — only flag within this window of the earlier lead's creation. */
export const DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Heuristic-only, never blocks creation — flags a new lead as a likely
 * re-submission of an existing one so a human can merge or dismiss it (see
 * services/leadService.ts's createLeadFromSubmission and the Lead's
 * possibleDuplicateOfLeadId field). Matches on email, phone, or Gmail
 * thread ID, but only against an existing Lead that's (a) still
 * "New Inquiry" — a fresh duplicate of an already-converted/archived lead
 * is far less useful to surface — and (b) was created within
 * DUPLICATE_WINDOW_MS of the new submission.
 */
export function findPossibleDuplicateLead(existingLeads: Lead[], candidate: NewLeadInput, candidateCreatedTime: string): Lead | null {
  const candidateEmail = candidate.email.trim().toLowerCase();
  const candidatePhone = candidate.phone ? normalizePhone(candidate.phone) : "";
  const candidateTime = new Date(candidateCreatedTime).getTime();

  for (const existing of existingLeads) {
    if (existing.status !== "New Inquiry") continue;

    const existingTime = new Date(existing.createdTime).getTime();
    if (Math.abs(candidateTime - existingTime) > DUPLICATE_WINDOW_MS) continue;

    const sameEmail = Boolean(candidateEmail) && existing.email.trim().toLowerCase() === candidateEmail;
    const samePhone = Boolean(candidatePhone) && Boolean(existing.phone) && normalizePhone(existing.phone) === candidatePhone;
    const sameGmailThread = Boolean(candidate.gmailThreadId) && existing.gmailThreadId === candidate.gmailThreadId;

    if (sameEmail || samePhone || sameGmailThread) {
      return existing;
    }
  }

  return null;
}
