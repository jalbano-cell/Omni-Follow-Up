import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// The cron endpoint has its own CRON_SECRET bearer-token auth, the intake
// endpoint (plus every /api/v1/* route — the public API and inbound
// webhooks) has its own per-business API-key auth, /e/[token] (the
// customer portal) authenticates via its own signed share token,
// /invite/[token] (accepting a team invite, services/userService.ts)
// authenticates via its own one-time DB-backed token, /api/unsubscribe/[token]
// (CASL unsubscribe, services/suppression.ts) authenticates via its own
// signed token (lib/auth.ts's createUnsubscribeToken) and redirects to the
// static /unsubscribed confirmation page, and the Gmail push webhook
// authenticates via a shared secret query token — all of these are called
// with no session cookie (Vercel Cron, a third-party website's contact form,
// an external integration, a customer's browser, an invited teammate who has
// no account yet, Google Cloud Pub/Sub) and must stay reachable without one.
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/follow-ups/generate",
  "/api/intake",
  "/api/v1",
  "/e",
  "/invite",
  "/api/unsubscribe",
  "/unsubscribed",
  "/api/webhooks/gmail-push",
];

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
  // without us enumerating them. 'unsafe-inline' in script-src is ignored by
  // browsers that honor 'strict-dynamic', so it's only a fallback for very
  // old ones — but 'unsafe-eval' is NOT implied by 'strict-dynamic' (that
  // keyword only affects script *loading*, not eval()/new Function() calls),
  // so it has to be listed explicitly wherever it's actually needed. Next's
  // dev server bundles modules with eval()-wrapped source maps (its default
  // devtool) — without this, every client component silently fails to
  // hydrate/attach event handlers under this CSP (confirmed: clicking an
  // accordion trigger did nothing, no console error, `aria-expanded` never
  // changed — the browser was blocking the eval() before the click handler
  // module ever ran). Restricted to non-production so the deployed app never
  // gets the weaker policy — a production build's output doesn't use eval.
  // style-src keeps 'unsafe-inline' because Next/Radix/Tailwind emit inline
  // style attributes (a far lower-risk sink than scripts, and hashing them
  // all isn't practical here). img/connect are permissive to allow Supabase
  // signed-URL assets and same-origin actions.
  const scriptSrc =
    process.env.NODE_ENV === "production"
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`;
  return [
    `default-src 'self'`,
    scriptSrc,
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
