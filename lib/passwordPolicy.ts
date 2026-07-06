// A small blocklist of the passwords credential-stuffing lists lead with. Not
// a substitute for a real breached-password check (e.g. HaveIBeenPwned's
// k-anonymity range API), but it cheaply rejects the worst offenders. Shared
// by signup (app/signup/actions.ts) and team-invite acceptance
// (app/invite/[token]/actions.ts) so both account-creation paths enforce the
// same policy.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "letmein1", "iloveyou", "admin123", "welcome1", "changeme1",
]);

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include both letters and numbers.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — choose something harder to guess.";
  return null;
}
