// Provide the secrets lib/env.ts requires, so modules that sign tokens
// (lib/auth.ts) or encrypt values (lib/crypto.ts) work under test. These are
// throwaway test values, never real secrets. UPSTASH_* are intentionally left
// unset so lib/rateLimit.ts exercises its in-memory fallback.
process.env.AUTH_SECRET ||= "test-auth-secret-0123456789abcdef0123456789abcdef";
process.env.TOKEN_ENCRYPTION_KEY ||= "test-token-encryption-key-abcdef0123456789";
