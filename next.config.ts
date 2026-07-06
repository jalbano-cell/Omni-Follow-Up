import type { NextConfig } from "next";

/**
 * Baseline security response headers applied to every route. These are the
 * high-value, framework-safe ones — they don't rely on nonces and won't break
 * Next.js's inline hydration scripts, Billing Checkout redirects, or Supabase
 * calls:
 *
 *  - Strict-Transport-Security: force HTTPS for a year (browsers ignore it on
 *    plain HTTP / localhost, so it's inert in dev).
 *  - X-Frame-Options + CSP frame-ancestors: block clickjacking — nothing here,
 *    including the public /e/[token] customer portal, should be iframed.
 *  - X-Content-Type-Options: stop MIME-sniffing.
 *  - Referrer-Policy: don't leak full URLs (which can carry share tokens) to
 *    third parties.
 *  - Permissions-Policy: deny camera/mic/geolocation the app never uses.
 *
 * The Content-Security-Policy is NOT here — it needs a per-request nonce to
 * coexist with Next.js hydration, so it's set in middleware.ts instead.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
