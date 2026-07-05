import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// The cron endpoint has its own CRON_SECRET bearer-token auth, the intake
// endpoint (plus every /api/v1/* route — the public API and inbound
// webhooks) has its own per-business API-key auth, /e/[token] (the
// customer portal) authenticates via its own signed share token, and the
// Stripe webhook authenticates via an HMAC signature over the raw body — all
// of these are called with no session cookie (Vercel Cron, a third-party
// website's contact form, an external integration, a customer's browser,
// Stripe itself) and must stay reachable without one.
const PUBLIC_PATHS = ["/login", "/signup", "/api/follow-ups/generate", "/api/intake", "/api/v1", "/e", "/api/webhooks/stripe"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionCookie);
  if (session) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|apple-touch-icon.png).*)"],
};
