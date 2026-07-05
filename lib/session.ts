import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { getBusinessById } from "@/services/business";
import type { Business, SessionPayload } from "@/types";

/**
 * Resolves the current business's identity for Server Components/Actions.
 * Independently re-verifies the JWT from the cookie rather than trusting
 * middleware-forwarded headers — cheap (one HMAC check) and removes an
 * entire class of "did middleware forward this on every path" bugs.
 *
 * Middleware already blocks unauthenticated requests from reaching here;
 * the redirect below is a defensive fallback, not the primary auth gate.
 */
export async function getCurrentSession(): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentBusinessId(): Promise<string> {
  const { businessId } = await getCurrentSession();
  return businessId;
}

/** The onboarding wizard step a business with this onboardingStep value still needs to complete. */
function onboardingStepPath(step: number): string {
  if (step >= 4) return "/onboarding/review";
  if (step >= 3) return "/onboarding/first-estimate";
  if (step >= 2) return "/onboarding/cadence";
  if (step >= 1) return "/onboarding/gmail";
  return "/onboarding/industry";
}

/**
 * Guard for every page/action that assumes onboarding is complete (i.e.
 * everything except the onboarding wizard itself). Redirects to whichever
 * step the business hasn't finished yet instead of letting it hit a page
 * that expects a fully-configured business.
 */
export async function requireOnboardedBusiness(): Promise<Business> {
  const { businessId } = await getCurrentSession();
  const business = await getBusinessById(businessId);
  if (!business) {
    redirect("/login");
  }
  if (!business.onboardingCompletedAt) {
    redirect(onboardingStepPath(business.onboardingStep));
  }
  return business;
}
