/**
 * Builds an absolute URL for a given host + path — localhost gets http,
 * everything else (Vercel prod/preview) gets https. Same protocol-detection
 * rule app/estimates/actions.ts's buildShareUrl already used for the
 * customer portal link; extracted here since the appointment-lifecycle
 * emails (services/appointmentService.ts, services/appointmentLifecycle.ts)
 * need the same thing from three different entry points (a Server Action, an
 * API route, and the cron route) that each resolve `host` their own way.
 */
export function buildAbsoluteUrl(host: string, path: string): string {
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${protocol}://${host}${path}`;
}
