import { defineConfig } from "vitest/config";

// Unit tests for the security-critical pure logic (token signing/verification,
// password hashing, token encryption, rate limiting, log masking). These are
// deterministic and dependency-free; DB-backed flows (tenant scoping, billing
// sync) would need a Supabase test harness and are intentionally out of scope
// here. resolve.tsconfigPaths wires up the `@/…` import alias from tsconfig.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
  },
});
