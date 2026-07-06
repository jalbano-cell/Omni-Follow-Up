import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthStateToken } from "@/lib/auth";
import { exchangeCodeForTokens, getGoogleAccountEmail } from "@/services/googleOAuth";
import { saveGoogleConnection, markOnboardingStep } from "@/services/business";
import { encrypt } from "@/lib/crypto";
import { logAction } from "@/lib/logger";

/** Completes the Google OAuth consent flow started by /api/oauth/google/start. */
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");

  const state = await verifyOAuthStateToken(stateToken);
  if (!state) {
    return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
  }

  const failureUrl = new URL(state.returnTo, request.url);
  failureUrl.searchParams.set("googleError", "1");

  if (error || !code) {
    logAction("auth.google-connect-failed", { businessId: state.businessId, error: error ?? "no_code" });
    return NextResponse.redirect(failureUrl);
  }

  try {
    const redirectUri = new URL("/api/oauth/google/callback", request.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refreshToken) {
      // Shouldn't happen with prompt=consent, but Google can still omit it in edge cases.
      logAction("auth.google-connect-failed", { businessId: state.businessId, error: "no_refresh_token" });
      return NextResponse.redirect(failureUrl);
    }

    const connectedEmail = await getGoogleAccountEmail(tokens.accessToken);
    await saveGoogleConnection(state.businessId, {
      encryptedRefreshToken: encrypt(tokens.refreshToken),
      connectedEmail,
      scopes: tokens.scope,
    });
    await markOnboardingStep(state.businessId, 1);

    logAction("auth.google-connected", { businessId: state.businessId, connectedEmail });
    return NextResponse.redirect(new URL(state.returnTo, request.url));
  } catch (err) {
    logAction("auth.google-connect-failed", {
      businessId: state.businessId,
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.redirect(failureUrl);
  }
}
