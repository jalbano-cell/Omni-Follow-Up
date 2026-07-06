import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getBusinessById } from "@/services/business";
import type { Business, SessionPayload } from "@/types";

/**
 * Verifies the cookie's JWT AND that it hasn't been revoked: the token's
 * tokenVersion must still match the business's current session_token_version
 * (logout/password-change bump it — see services/business.ts). This is the
 * one place that check happens; middleware only does the signature/expiry
 * check (it's Edge and can't read the DB), so authorization for anything that
 * touches data flows through here. Returns the business too, since we had to
 * load it anyway, so callers like requireOnboardedBusiness don't re-fetch.
 */
async function resolveValidatedSession(): Promise<{ session: SessionPayload; business: Business } | null> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  const business = await getBusinessById(session.businessId);
  if (!business) return null;
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
