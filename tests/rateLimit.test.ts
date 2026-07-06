import { describe, it, expect } from "vitest";
import { rateLimit } from "@/lib/rateLimit";

// UPSTASH_* are unset in tests/setup.ts, so this exercises the in-memory
// fallback. Each test uses a unique key so the module-level buckets from other
// tests don't interfere.

describe("rateLimit (in-memory fallback)", () => {
  it("allows up to `max` attempts, then limits", async () => {
    const key = `test-basic-${Math.random()}`;
    const opts = { max: 3, windowMs: 60_000 };

    expect((await rateLimit(key, opts)).limited).toBe(false); // 1
    expect((await rateLimit(key, opts)).limited).toBe(false); // 2
    expect((await rateLimit(key, opts)).limited).toBe(false); // 3
    expect((await rateLimit(key, opts)).limited).toBe(true); // 4 -> over
  });

  it("reports remaining counting down to 0", async () => {
    const key = `test-remaining-${Math.random()}`;
    const opts = { max: 2, windowMs: 60_000 };

    expect((await rateLimit(key, opts)).remaining).toBe(1);
    expect((await rateLimit(key, opts)).remaining).toBe(0);
    expect((await rateLimit(key, opts)).remaining).toBe(0);
  });

  it("tracks separate keys independently", async () => {
    const a = `test-a-${Math.random()}`;
    const b = `test-b-${Math.random()}`;
    const opts = { max: 1, windowMs: 60_000 };

    expect((await rateLimit(a, opts)).limited).toBe(false);
    expect((await rateLimit(a, opts)).limited).toBe(true);
    // b is untouched by a's attempts.
    expect((await rateLimit(b, opts)).limited).toBe(false);
  });

  it("forgets attempts once they age out of the window", async () => {
    const key = `test-window-${Math.random()}`;
    const opts = { max: 1, windowMs: 30 };

    expect((await rateLimit(key, opts)).limited).toBe(false);
    expect((await rateLimit(key, opts)).limited).toBe(true);
    await new Promise((r) => setTimeout(r, 45));
    expect((await rateLimit(key, opts)).limited).toBe(false);
  });
});
