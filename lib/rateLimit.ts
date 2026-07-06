/**
 * Shared in-memory sliding-window rate limiter, used by the login/signup
 * Server Actions and the intake pipeline (services/intakeService.ts).
 *
 * Best-effort, NOT a hard security boundary: state lives in process memory, so
 * it resets on cold start and isn't shared across concurrent serverless
 * instances — a determined attacker spread across instances can exceed the
 * nominal limit. It exists to blunt casual credential-stuffing/spam. For a
 * hard guarantee, back this with a shared store (Upstash/Redis) keyed the same
 * way; every call site already funnels through this one module, so swapping
 * the implementation here is the only change that would take.
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Occasionally evict stale buckets so the Map doesn't grow unbounded on a
// long-lived instance (each cleanup only runs when we're already touching the
// map, so there's no separate timer to leak).
let opsSinceSweep = 0;
const SWEEP_EVERY = 500;

function sweep(now: number, windowMs: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.hits.every((t) => now - t >= windowMs)) buckets.delete(key);
  }
}

export interface RateLimitResult {
  limited: boolean;
  /** Attempts remaining in the current window (0 once limited). */
  remaining: number;
}

/**
 * Records one attempt for `key` and reports whether it exceeded `max` within
 * `windowMs`. The attempt is always counted, so repeated calls while limited
 * keep the window sliding forward (a caller can't reset their own clock by
 * hammering — they just stay limited until they go quiet for a full window).
 */
export function rateLimit(key: string, { max, windowMs }: { max: number; windowMs: number }): RateLimitResult {
  const now = Date.now();

  if (++opsSinceSweep >= SWEEP_EVERY) {
    opsSinceSweep = 0;
    sweep(now, windowMs);
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
  bucket.hits.push(now);
  buckets.set(key, bucket);

  const limited = bucket.hits.length > max;
  return { limited, remaining: Math.max(0, max - bucket.hits.length) };
}
