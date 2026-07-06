import type { NextConfig } from "next";

/**
 * Baseline security response headers applied to every route. These are the
 * high-value, framework-safe ones — they don't rely on nonces and won't break
 * Next.js's inline hydration scripts, Stripe Checkout redirects, or Supabase
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
 * A full script-src/style-src CSP needs per-request nonces to coexist with
 * Next.js hydration; that's a larger change and is intentionally left for a
 * follow-up so this baseline can ship without risk of a blank page.
 */
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
