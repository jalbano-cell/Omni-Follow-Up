import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getBusinessById } from "@/services/business";
import { getTeamMemberById } from "@/services/userService";
import type { Business, SessionPayload } from "@/types";

/**
 * Verifies the cookie's JWT AND that it hasn't been revoked. For the
 * workspace owner (no `userId` in the token), the tokenVersion must match
 * the business's current session_token_version. For a team member
 * (services/userService.ts), it must instead match that member's own,
 * independent session_token_version (migration 0014) — the member's own row
 * is also re-checked to exist and still be accepted, so a removed member's
 * token stops validating immediately rather than just once it expires.
 * Middleware only does the signature/expiry check (it's Edge and can't read
 * the DB), so authorization for anything that touches data flows through
 * here. Returns the business too, since we had to load it anyway, so callers
 * like requireOnboardedBusiness don't re-fetch.
 */
async function resolveValidatedSession(): Promise<{ session: SessionPayload; business: Business } | null> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const business = await getBusinessById(session.businessId);
  if (!business) return null;

  if (session.userId) {
    const member = await getTeamMemberById(session.userId);
    if (!member || member.workspaceId !== business.id || !member.acceptedAt) return null;
    if ((session.tokenVersion ?? 0) !== member.sessionTokenVersion) return null;
    return { session, business };
  }

  if ((session.tokenVersion ?? 0) !== business.sessionTokenVersion) return null;
  return { session, business };
}

/**
 * Resolves the current business's identity for Server Components/Actions.
 * Independently re-verifies (and re-checks revocation of) the cookie rather
 * than trusting middleware-forwarded headers — removes an entire class of
 * "did middleware forward this on every path" bugs.
 *
 * Middleware already blocks unauthenticated requests from reaching here;
 * the redirect below is a defensive fallback, not the primary auth gate.
 */
export async function getCurrentSession(): Promise<SessionPayload> {
  const resolved = await resolveValidatedSession();
  if (!resolved) {
    redirect("/login");
  }
  return resolved.session;
}

export async function getCurrentBusinessId(): Promise<string> {
  const { businessId } = await getCurrentSession();
  return businessId;
}

/**
 * Same lookup as getCurrentSession, but returns null instead of redirecting
 * — for spots that render on every route including public ones (e.g. the
 * root layout's notification bell), where "no session" is a normal case,
 * not a protected page a user got to unauthenticated.
 */
export async function getOptionalSession(): Promise<SessionPayload | null> {
  const resolved = await resolveValidatedSession();
  return resolved?.session ?? null;
}

/** The onboarding wizard step a business with this onboardingStep value still needs to complete. */
function onboardingStepPath(step: number): string {
  if (step >= 3) return "/onboarding/review";
  if (step >= 2) return "/onboarding/hours";
  if (step >= 1) return "/onboarding/cadence";
  return "/onboarding/gmail";
}

/**
 * Guard for every page/action that assumes onboarding is complete (i.e.
 * everything except the onboarding wizard itself). Redirects to whichever
 * step the business hasn't finished yet instead of letting it hit a page
 * that expects a fully-configured business.
 */
export async function requireOnboardedBusiness(): Promise<Business> {
  const resolved = await resolveValidatedSession();
  if (!resolved) {
    redirect("/login");
  }
  const { business } = resolved;
  if (!business.onboardingCompletedAt) {
    redirect(onboardingStepPath(business.onboardingStep));
  }
  return business;
}

/**
 * Guard for Settings — billing, the Google connection, API keys, outbound
 * webhooks, and team management are all workspace-owner-only; an invited
 * team member (session.role === "member") gets redirected to the dashboard
 * rather than reaching any of it. Everything else in the app (estimates,
 * leads, follow-ups, replies, analytics) is shared by every team member —
 * this is the one, deliberately narrow permission boundary the product has.
 */
export async function requireOwner(): Promise<Business> {
  const business = await requireOnboardedBusiness();
  const session = await getCurrentSession();
  if (session.role === "member") {
    redirect("/");
  }
  return business;
}
