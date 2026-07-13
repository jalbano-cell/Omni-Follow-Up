"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createBusinessForAgency, getBusinessByEmail, updateBusiness, getAllActiveBusinesses } from "@/services/business";
import { createOwnerClaim, getTeamMemberByEmail, TeamMemberEmailInUseError } from "@/services/userService";
import { buildOnboardingWelcomeEmail } from "@/services/emailTemplates/onboardingWelcome";
import { sendEmail } from "@/services/gmail";
import { runDailyGmailLeadCaptureJob } from "@/services/gmailLeadCapture";
import { decrypt } from "@/lib/crypto";
import { requireAdmin } from "@/lib/session";
import { logAction } from "@/lib/logger";
import { PRODUCT_MODE_OPTIONS } from "@/config/constants";
import type { WorkspacePlan, WorkspaceStatus, WorkspaceProductMode } from "@/types";

const PLAN_VALUES: WorkspacePlan[] = ["grow", "transform"];
const STATUS_VALUES: WorkspaceStatus[] = ["active", "inactive", "suspended"];
const PRODUCT_MODE_VALUES: WorkspaceProductMode[] = PRODUCT_MODE_OPTIONS;

async function getAdminBaseUrl(): Promise<string> {
  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}`;
}

/**
 * Creates a brand-new client workspace, active immediately, and returns a
 * one-time claim link (services/userService.ts's createOwnerClaim — same
 * token/expiry mechanics and the same /invite/[token] accept page as a team
 * invite, but promotes the client to real workspace owner on acceptance
 * rather than adding them as a teammate) plus the rendered handoff email
 * (services/emailTemplates/onboardingWelcome.ts) for the admin to copy and
 * send manually — there's no automatic send here, since the client hasn't
 * connected Gmail yet (this app only ever sends through a business's own
 * connected Gmail, never a system sender). Gated by requireAdmin() — only
 * reachable by the one workspace named in ADMIN_WORKSPACE_ID.
 */
export async function provisionNewWorkspaceAction(formData: FormData): Promise<{
  error?: string;
  claimUrl?: string;
  emailSubject?: string;
  emailBody?: string;
  ownerName?: string;
  ownerEmail?: string;
  businessName?: string;
  /** Whether sendOnboardingWelcomeEmailAction can actually send this — the admin's own workspace needs Gmail connected. */
  canSendEmail?: boolean;
}> {
  const adminBusiness = await requireAdmin();

  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "") as WorkspacePlan;
  const productMode = String(formData.get("productMode") ?? "both") as WorkspaceProductMode;

  if (!businessName || !ownerName || !ownerEmail) {
    return { error: "Business name, owner name, and owner email are all required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { error: "Enter a valid owner email address." };
  }
  if (!PLAN_VALUES.includes(plan)) {
    return { error: "Invalid plan selection." };
  }
  if (!PRODUCT_MODE_VALUES.includes(productMode)) {
    return { error: "Invalid product mode selection." };
  }

  // Check for a collision BEFORE inserting — createBusinessForAgency has no
  // guard of its own (workspaces.owner_email has a unique index), so without
  // this a resubmit or a re-provision of an email that already has an
  // account crashes with an unhandled duplicate-key error instead of a clean
  // message. createOwnerClaim below has its own copy of this same check,
  // but that runs *after* the insert — too late to prevent this exact crash.
  const [existingBusiness, existingMember] = await Promise.all([
    getBusinessByEmail(ownerEmail),
    getTeamMemberByEmail(ownerEmail),
  ]);
  if (existingBusiness || existingMember) {
    return { error: "That email is already associated with an Omni Follow Up account." };
  }

  const business = await createBusinessForAgency({ businessName, ownerName, ownerEmail, plan, productMode });

  let claim;
  try {
    claim = await createOwnerClaim(business.id, { email: ownerEmail, name: ownerName });
  } catch (error) {
    if (error instanceof TeamMemberEmailInUseError) {
      return { error: error.message };
    }
    throw error;
  }

  logAction("admin.workspace-provisioned", { businessId: business.id, plan, productMode });

  const baseUrl = await getAdminBaseUrl();
  const claimUrl = `${baseUrl}/invite/${claim.inviteToken}`;
  const email = buildOnboardingWelcomeEmail({
    ownerName,
    businessName,
    claimUrl,
    agencyOwnerName: adminBusiness.ownerName,
  });

  revalidatePath("/admin");
  return {
    claimUrl,
    emailSubject: email.subject,
    emailBody: email.body,
    ownerName,
    ownerEmail,
    businessName,
    canSendEmail: Boolean(adminBusiness.googleRefreshTokenEnc),
  };
}

/**
 * Sends the onboarding welcome email through the agency's OWN connected
 * Gmail (services/gmail.ts — the same per-tenant sender every other email in
 * this app uses, just with the admin's workspace as the sender instead of
 * the new client's, since the client has no Gmail connection yet). A
 * deliberate button click, not fired automatically on every provision — a
 * real send to a real client's inbox warranted an explicit action rather
 * than firing silently. Re-renders the email from its canonical inputs
 * rather than trusting client-supplied subject/body text, so this action
 * stays scoped to "send the onboarding email for this workspace," not
 * "send arbitrary text through my Gmail."
 */
export async function sendOnboardingWelcomeEmailAction(formData: FormData): Promise<{ error?: string }> {
  const adminBusiness = await requireAdmin();

  if (!adminBusiness.googleRefreshTokenEnc || !adminBusiness.googleConnectedEmail) {
    return { error: "Connect your own Gmail in Settings first, then you can send this directly." };
  }

  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const claimUrl = String(formData.get("claimUrl") ?? "").trim();

  if (!businessName || !ownerName || !ownerEmail || !claimUrl) {
    return { error: "Missing workspace details — try provisioning again." };
  }

  const email = buildOnboardingWelcomeEmail({ ownerName, businessName, claimUrl, agencyOwnerName: adminBusiness.ownerName });

  try {
    await sendEmail({
      refreshToken: decrypt(adminBusiness.googleRefreshTokenEnc),
      fromEmail: adminBusiness.googleConnectedEmail,
      to: ownerEmail,
      subject: email.subject,
      body: email.body,
    });
  } catch (error) {
    logAction("admin.onboarding-email-send-failed", { ownerEmail, error: error instanceof Error ? error.message : "unknown error" });
    return { error: "Failed to send — check your Gmail connection in Settings and try again, or copy the email above instead." };
  }

  logAction("admin.onboarding-email-sent", { ownerEmail });
  return {};
}

/**
 * Activates (or adjusts the plan/status of) an already-existing, already-
 * self-signed-up workspace — no invite needed here, since it already has a
 * real owner login; flipping status to 'active' is enough to unlock it the
 * next time that owner logs in. Targeted by workspaceId (from the /admin
 * workspace list, not an ambient "current business") — this operates on an
 * explicit target workspace, distinct from the admin's own session.
 *
 * Returns void, not an error object — unlike provisionNewWorkspaceAction,
 * this is bound directly as a plain <form action> (see app/admin/page.tsx),
 * which requires a void-returning action; the plan/status <select>s already
 * constrain input to valid values, so the thrown error below is only
 * reachable via direct tampering, not normal use.
 */
export async function updateWorkspaceEntitlementAction(workspaceId: string, formData: FormData): Promise<void> {
  await requireAdmin();

  const plan = String(formData.get("plan") ?? "") as WorkspacePlan;
  const status = String(formData.get("status") ?? "") as WorkspaceStatus;
  const productMode = String(formData.get("productMode") ?? "") as WorkspaceProductMode;

  if (!PLAN_VALUES.includes(plan) || !STATUS_VALUES.includes(status) || !PRODUCT_MODE_VALUES.includes(productMode)) {
    throw new Error("Invalid plan, status, or product mode selection.");
  }

  await updateBusiness(workspaceId, { plan, status, productMode });
  logAction("admin.workspace-entitlement-updated", { businessId: workspaceId, plan, status, productMode });

  revalidatePath("/admin");
}

/**
 * Manual trigger for tuning the lead classifier's prompt (services/leadClassification.ts)
 * without waiting for the daily cron (app/api/follow-ups/generate/route.ts,
 * gated to 8am local per business) to come back around. Reuses the exact
 * same job the cron calls — services/gmailLeadCapture.ts's
 * runDailyGmailLeadCaptureJob — for every active business, right now.
 *
 * Note this also runs the pre-existing, unrelated Gmail lead-capture step
 * alongside classification: any qualifying new message still becomes a Lead,
 * exactly as it would on the next scheduled cron run — this button just
 * doesn't wait for that. Classification itself never gates or blocks that,
 * on this run or any other (see the doc comment on classifyAndLogMessage).
 */
export async function runLeadClassificationNowAction(): Promise<{ error?: string; summary?: string }> {
  await requireAdmin();

  const businesses = await getAllActiveBusinesses();
  const appHost = (await headers()).get("host") ?? "localhost:3000";
  const logs = await runDailyGmailLeadCaptureJob(businesses, appHost);

  const scanned = logs.reduce((sum, l) => sum + l.messagesScanned, 0);
  const created = logs.reduce((sum, l) => sum + l.leadsCreated, 0);
  logAction("admin.lead-classification-run", { businesses: businesses.length, scanned, created });

  revalidatePath("/admin/classifications");
  return { summary: `Scanned ${scanned} message(s) across ${businesses.length} business(es) — ${created} new lead(s) created.` };
}
