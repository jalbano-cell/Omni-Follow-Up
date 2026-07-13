import { NextRequest, NextResponse } from "next/server";
import { verifyOAuthStateToken } from "@/lib/auth";
import { exchangeCodeForTokens, getMicrosoftAccountEmail } from "@/services/microsoftOAuth";
import { upsertMailboxConnection } from "@/services/mailboxConnections";
import { encrypt } from "@/lib/crypto";
import { env } from "@/lib/env";
import { logAction } from "@/lib/logger";

/**
 * Completes the Microsoft OAuth consent flow started by
 * /api/oauth/microsoft/start — mirrors
 * app/api/oauth/google/callback/route.ts's structure and error handling.
 * Two differences from Google's callback: this reads the PKCE code_verifier
 * back out of the state token for the exchange, and it saves the connection
 * to mailbox_connections directly (services/mailboxConnections.ts) rather
 * than a workspaces-column setter, since Microsoft has no legacy columns —
 * that table is its only store. No onboarding-step marking or watch
 * registration — connecting Microsoft isn't part of the onboarding wizard,
 * and real-time push sync is a Gmail-specific enhancement out of scope here.
 */
export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const stateToken = request.nextUrl.searchParams.get("state");

  const state = await verifyOAuthStateToken(stateToken);
  if (!state) {
    return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
  }

  const failureUrl = new URL(state.returnTo, request.url);
  failureUrl.searchParams.set("microsoftError", "1");

  if (error || !code) {
    logAction("auth.microsoft-connect-failed", { businessId: state.businessId, error: error ?? "no_code" });
    return NextResponse.redirect(failureUrl);
  }

  if (!state.codeVerifier) {
    // Shouldn't happen for a flow that started at /api/oauth/microsoft/start,
    // which always sets one — defensive only.
    logAction("auth.microsoft-connect-failed", { businessId: state.businessId, error: "no_code_verifier" });
    return NextResponse.redirect(failureUrl);
  }

  try {
    const redirectUri = env.microsoftRedirectUri ?? new URL("/api/oauth/microsoft/callback", request.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri, state.codeVerifier);
    if (!tokens.refreshToken) {
      // Shouldn't happen with offline_access requested + prompt=consent, but
      // Microsoft can still omit it in edge cases, same as Google.
      logAction("auth.microsoft-connect-failed", { businessId: state.businessId, error: "no_refresh_token" });
      return NextResponse.redirect(failureUrl);
    }

    const connectedEmail = await getMicrosoftAccountEmail(tokens.accessToken);
    await upsertMailboxConnection(state.businessId, "microsoft", {
      refreshTokenEnc: encrypt(tokens.refreshToken),
      connectedEmail,
      scopes: tokens.scope,
    });

    logAction("auth.microsoft-connected", { businessId: state.businessId, connectedEmail });
    return NextResponse.redirect(new URL(state.returnTo, request.url));
  } catch (err) {
    logAction("auth.microsoft-connect-failed", {
      businessId: state.businessId,
      error: err instanceof Error ? err.message : "unknown error",
    });
    return NextResponse.redirect(failureUrl);
  }
}
