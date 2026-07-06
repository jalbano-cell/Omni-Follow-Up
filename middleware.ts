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

/**
 * Per-request base64 nonce for the Content-Security-Policy below. Next.js
 * reads it from the request's CSP header we forward and stamps it onto every
 * framework `<script>`, so `script-src` can drop 'unsafe-inline' entirely —
 * the meaningful XSS control. Uses Web Crypto (available in the Edge runtime
 * middleware runs in).
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

function buildCsp(nonce: string): string {
  // 'strict-dynamic' lets Next's nonced bootstrap script load its chunks
  // without us enumerating them. 'unsafe-inline'/'unsafe-eval' in script-src
  // are ignored by browsers that honor 'strict-dynamic', so they're only a
  // fallback for very old ones. style-src keeps 'unsafe-inline' because
  // Next/Radix/Tailwind emit inline style attributes (a far lower-risk sink
  // than scripts, and hashing them all isn't practical here). img/connect are
  // permissive to allow Supabase signed-URL assets and same-origin actions.
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https:`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join("; ");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  // Forward the nonce + CSP to the app on the *request* so Next can pick up the
  // nonce during render; also set CSP on the *response* so the browser enforces it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const allow = () => NextResponse.next({ request: { headers: requestHeaders } });

  let response: NextResponse;
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    response = allow();
  } else {
    const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (session) {
      response = allow();
    } else {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      response = NextResponse.redirect(loginUrl);
    }
  }

  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg|apple-touch-icon.png).*)"],
};
