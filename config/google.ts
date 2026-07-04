export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Requested together in one consent grant (not two separate connect flows)
 * so a business only goes through Google's consent screen once, covering
 * both the Gmail queue (send + read replies) and Calendar reminders.
 */
export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;
