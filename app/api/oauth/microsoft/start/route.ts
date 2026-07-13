import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken, createOAuthStateToken } from "@/lib/auth";
import { generatePkcePair } from "@/lib/pkce";
import { buildAuthUrl } from "@/services/microsoftOAuth";
import { env } from "@/lib/env";

/**
 * Where the Microsoft OAuth callback can safely send a business back to.
 * Microsoft-only — unlike Google, connecting Microsoft isn't part of the
 * onboarding wizard (that stays Google-first per CLAUDE.md's "as little
 * technical setup as possible" philosophy), so this is Settings-only.
 */
const ALLOWED_RETURN_PATHS = ["/settings"];

/**
 * Kicks off the Microsoft OAuth consent flow for the signed-in business —
 * mirrors app/api/oauth/google/start/route.ts exactly, with one addition:
 * generates a PKCE pair and carries the code_verifier through the signed
 * state token (lib/auth.ts's OAuthStatePayload) for the callback to use at
 * token exchange, since there's no server-side OAuth session store.
 */
export async function GET(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!env.microsoftClientId || !env.microsoftClientSecret) {
    return NextResponse.json({ error: "Microsoft mailbox connections aren't configured on this deployment." }, { status: 501 });
  }

  const returnTo = request.nextUrl.searchParams.get("returnTo") ?? "/settings";
  if (!ALLOWED_RETURN_PATHS.includes(returnTo)) {
    return NextResponse.json({ error: "Invalid returnTo path." }, { status: 400 });
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = await createOAuthStateToken({ businessId: session.businessId, returnTo, codeVerifier });
  const redirectUri = env.microsoftRedirectUri ?? new URL("/api/oauth/microsoft/callback", request.url).toString();

  return NextResponse.redirect(buildAuthUrl(state, redirectUri, codeChallenge));
}
