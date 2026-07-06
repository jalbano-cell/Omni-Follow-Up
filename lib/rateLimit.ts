import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiter used by the login/signup Server Actions and the intake pipeline
 * (services/intakeService.ts).
 *
 * Two backends, chosen at runtime:
 *
 *  - Upstash Redis (when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are
 *    set): a real sliding-window counter shared across every serverless
 *    instance — the hard guarantee. This is what production should use.
 *  - In-memory fallback (when they're not): best-effort only. State lives in
 *    process memory, so it resets on cold start and isn't shared across
 *    concurrent instances. Fine for local dev and as a safety net if Redis is
 *    briefly unreachable.
 *
 * Every call site funnels through `rateLimit` here, so swapping/adding a
 * backend is a change to this one file.
 */

export interface RateLimitResult {
  limited: boolean;
  /** Attempts remaining in the current window (0 once limited). */
  remaining: number;
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
}

// --- Upstash backend (lazy, only if configured) ----------------------------

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

// One Ratelimit instance per distinct max+window config (they're cheap but
// stateful over the shared redis client); keyed so we don't rebuild per call.
const limiters = new Map<string, Ratelimit>();

function getUpstashLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      // `${windowMs} ms` is a valid Upstash Duration; sliding window matches
      // the in-memory fallback's semantics so behavior is consistent.
      limiter: Ratelimit.slidingWindow(max, `${windowMs} ms`),
      prefix: "rl",
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

// --- In-memory fallback -----------------------------------------------------

const buckets = new Map<string, number[]>();
let opsSinceSweep = 0;
const SWEEP_EVERY = 500;

function inMemoryRateLimit(key: string, { max, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();

  if (++opsSinceSweep >= SWEEP_EVERY) {
    opsSinceSweep = 0;
    for (const [k, hits] of buckets) {
      if (hits.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }

  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);

  return { limited: hits.length > max, remaining: Math.max(0, max - hits.length) };
}

/**
 * Records one attempt for `key` and reports whether it exceeded `max` within
 * `windowMs`. Async because the Redis backend is a network round-trip; the
 * in-memory fallback resolves synchronously. If a configured Redis call throws
 * (network blip), we fail OPEN — a rate limiter should never take down login —
 * and fall back to the in-memory counter for that call.
 */
export async function rateLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
  if (redis) {
    try {
      const { success, remaining } = await getUpstashLimiter(options.max, options.windowMs).limit(key);
      return { limited: !success, remaining };
    } catch {
      return inMemoryRateLimit(key, options);
    }
  }
  return inMemoryRateLimit(key, options);
}
