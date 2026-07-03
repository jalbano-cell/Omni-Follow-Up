function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Check .env.local against .env.example.`
    );
  }
  return value;
}

export const env = {
  get airtableApiKey() {
    return requireEnv("AIRTABLE_API_KEY");
  },
  get airtableBaseId() {
    return requireEnv("AIRTABLE_BASE_ID");
  },
  get defaultBusinessName() {
    return process.env.DEFAULT_BUSINESS_NAME ?? "Your Business";
  },
  get gmailClientId() {
    return requireEnv("GMAIL_CLIENT_ID");
  },
  get gmailClientSecret() {
    return requireEnv("GMAIL_CLIENT_SECRET");
  },
  get gmailRefreshToken() {
    return requireEnv("GMAIL_REFRESH_TOKEN");
  },
  get gmailUserEmail() {
    return requireEnv("GMAIL_USER_EMAIL");
  },
};
