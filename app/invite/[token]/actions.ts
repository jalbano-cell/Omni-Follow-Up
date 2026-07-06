"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTeamMemberByInviteToken, acceptInvite, claimWorkspaceOwnership, isInviteAcceptable } from "@/services/userService";
import { hashPassword } from "@/lib/password";
import { passwordProblem } from "@/lib/passwordPolicy";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { logAction } from "@/lib/logger";

export async function acceptInviteAction(token: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const member = await getTeamMemberByInviteToken(token);
  if (!isInviteAcceptable(member)) {
    redirect(`/invite/${token}?error=${encodeURIComponent("This invite link is invalid or has expired.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/invite/${token}?error=${encodeURIComponent("Passwords don't match.")}`);
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) {
    redirect(`/invite/${token}?error=${encodeURIComponent(pwProblem)}`);
  }

  const passwordHash = await hashPassword(password);
  const cookieStore = await cookies();

  // An owner-role claim (services/userService.ts's createOwnerClaim, from
  // app/admin/actions.ts's provisionNewWorkspaceAction) is a one-time claim
  // on a brand-new workspace, not a teammate joining an existing one:
  // promote the password onto the workspace itself and sign a normal owner
  // session (no userId/role) — after this the `users` row is gone and the
  // workspace is indistinguishable from one created via /signup.
  if (member.role === "owner") {
    const business = await claimWorkspaceOwnership(member, passwordHash);
    logAction("auth.workspace-claimed", { businessId: business.id });

    cookieStore.set(
      SESSION_COOKIE_NAME,
      await createSessionToken({
        businessId: business.id,
        email: business.ownerEmail,
        tokenVersion: business.sessionTokenVersion,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );
    redirect("/onboarding/gmail");
  }

  const accepted = await acceptInvite(member.id, passwordHash);
  logAction("auth.invite-accepted", { businessId: accepted.workspaceId, memberId: accepted.id });

  cookieStore.set(
    SESSION_COOKIE_NAME,
    await createSessionToken({
      businessId: accepted.workspaceId,
      email: accepted.email,
      tokenVersion: accepted.sessionTokenVersion,
      userId: accepted.id,
      role: "member",
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    }
  );

  redirect("/");
}
