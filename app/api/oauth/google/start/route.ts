import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken, createOAuthStateToken } from "@/lib/auth";
import { buildAuthUrl } from "@/services/googleOAuth";

/** Where the Google OAuth callback can safely send a business back to. */
const ALLOWED_RETURN_PATHS = ["/onboarding/cadence", "/settings"];

/**
 * Kicks off the Google OAuth consent flow for the signed-in business.
 * Reached from either the onboarding wizard's "Connect Google" step or the
 * Settings page's "Reconnect" action — `returnTo` records which, so the
 * callback route knows where to send the business back afterward.
 */
export async function GET(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/settings";
  if (!ALLOWED_RETURN_PATHS.includes(returnTo)) {
    return NextResponse.json({ error: "Invalid returnTo path." }, { status: 400 });
  }

  const state = await createOAuthStateToken({ businessId: session.businessId, returnTo });
  const redirectUri = new URL("/api/oauth/google/callback", request.url).toString();

  return NextResponse.redirect(buildAuthUrl(state, redirectUri));
}
