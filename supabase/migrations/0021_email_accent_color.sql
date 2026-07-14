-- ---------------------------------------------------------------------------
-- Per-workspace email accent color
-- ---------------------------------------------------------------------------
-- Lets a business brand its own automated emails (services/emailTemplates/
-- emailLayout.ts's renderEmailShell/renderEmailHtml, services/emailTemplates/
-- leadNotification.ts) with its own accent color instead of the app's default
-- indigo. Null = use DEFAULT_EMAIL_ACCENT_COLOR (config/constants.ts).
alter table workspaces add column if not exists email_accent_color text;
