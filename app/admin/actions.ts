"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createBusinessForAgency, updateBusiness } from "@/services/business";
import { createOwnerClaim, TeamMemberEmailInUseError } from "@/services/userService";
import { buildOnboardingWelcomeEmail } from "@/services/emailTemplates/onboardingWelcome";
import { requireAdmin } from "@/lib/session";
import { logAction } from "@/lib/logger";
import type { WorkspacePlan, WorkspaceStatus } from "@/types";

const PLAN_VALUES: WorkspacePlan[] = ["grow", "transform"];
const STATUS_VALUES: WorkspaceStatus[] = ["active", "inactive", "suspended"];

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
export async function provisionNewWorkspaceAction(
  formData: FormData
): Promise<{ error?: string; claimUrl?: string; emailSubject?: string; emailBody?: string }> {
  const adminBusiness = await requireAdmin();

  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const plan = String(formData.get("plan") ?? "") as WorkspacePlan;

  if (!businessName || !ownerName || !ownerEmail) {
    return { error: "Business name, owner name, and owner email are all required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return { error: "Enter a valid owner email address." };
  }
  if (!PLAN_VALUES.includes(plan)) {
    return { error: "Invalid plan selection." };
  }

  const business = await createBusinessForAgency({ businessName, ownerName, ownerEmail, plan });

  let claim;
  try {
    claim = await createOwnerClaim(business.id, { email: ownerEmail, name: ownerName });
  } catch (error) {
    if (error instanceof TeamMemberEmailInUseError) {
      return { error: error.message };
    }
    throw error;
  }

  logAction("admin.workspace-provisioned", { businessId: business.id, plan });

  const baseUrl = await getAdminBaseUrl();
  const claimUrl = `${baseUrl}/invite/${claim.inviteToken}`;
  const email = buildOnboardingWelcomeEmail({
    ownerName,
    businessName,
    claimUrl,
    agencyOwnerName: adminBusiness.ownerName,
  });

  revalidatePath("/admin");
  return { claimUrl, emailSubject: email.subject, emailBody: email.body };
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

  if (!PLAN_VALUES.includes(plan) || !STATUS_VALUES.includes(status)) {
    throw new Error("Invalid plan or status selection.");
  }

  await updateBusiness(workspaceId, { plan, status });
  logAction("admin.workspace-entitlement-updated", { businessId: workspaceId, plan, status });

  revalidatePath("/admin");
}
