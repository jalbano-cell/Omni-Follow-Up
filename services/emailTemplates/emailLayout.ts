import { DEFAULT_EMAIL_ACCENT_COLOR } from "@/config/constants";

export const TEXT_COLOR = "#18181B";
export const MUTED_COLOR = "#71717A";
export const BORDER_COLOR = "#E4E4E7";
export const PAGE_BG = "#F4F4F5";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Runs after escapeHtml, so it's safe to match raw "http(s)://" runs — none can appear inside an escaped entity. */
function linkify(escaped: string, accentColor: string): string {
  return escaped.replace(
    /https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" style="color:${accentColor};text-decoration:underline;">${url}</a>`
  );
}

/**
 * services/emailTemplates/complianceFooter.ts always renders the unsubscribe
 * line as literal "Unsubscribe: <url>" text — this turns that into the
 * bare word "Unsubscribe" carrying the link, instead of a raw URL sitting
 * in the email. Matched (and consumed) before the generic linkify() below
 * so that pass never sees this URL and double-wraps it.
 */
function linkifyUnsubscribe(escaped: string, accentColor: string): string {
  return escaped.replace(
    /Unsubscribe:\s*(https?:\/\/\S+)/,
    (_match, url: string) => `<a href="${url}" style="color:${accentColor};text-decoration:underline;">Unsubscribe</a>`
  );
}

function renderParagraph(paragraph: string, isFooter: boolean, accentColor: string): string {
  const escaped = escapeHtml(paragraph);
  const html = (isFooter ? linkifyUnsubscribe(escaped, accentColor) : linkify(escaped, accentColor)).replace(/\n/g, "<br>");
  return isFooter
    ? `<p style="margin:0;font-size:12px;line-height:1.7;color:${MUTED_COLOR};">${html}</p>`
    : `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${TEXT_COLOR};">${html}</p>`;
}

/**
 * The branded card shell every automated email renders inside — accent
 * header bar with the business name, white card body holding `innerHtml`.
 * Table layout + inline styles throughout, since <style> blocks, flexbox,
 * and grid are unreliable across mail clients (Outlook in particular).
 * `accentColor` is per-business (services/business.ts's
 * getEffectiveEmailAccentColor) — callers pass it through rather than this
 * file hardcoding one, so each workspace's emails can carry its own brand
 * color instead of the app's default indigo.
 * Shared by renderEmailHtml (generic paragraph content) and any
 * template-specific layout (e.g. services/emailTemplates/leadNotification.ts's
 * details table) that wants the same wrapper around custom markup.
 */
export function renderEmailShell(businessName: string, innerHtml: string, accentColor: string = DEFAULT_EMAIL_ACCENT_COLOR): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:${PAGE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${PAGE_BG};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;border:1px solid ${BORDER_COLOR};">
            <tr>
              <td style="background-color:${accentColor};padding:20px 28px;border-radius:12px 12px 0 0;">
                <span style="font-size:16px;font-weight:600;color:#ffffff;">${escapeHtml(businessName)}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                ${innerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Converts one of this app's plain-text email bodies — paragraphs joined by
 * "\n\n", the convention every services/emailTemplates/*.ts builder already
 * follows — into HTML paragraphs inside the shared renderEmailShell.
 * Deliberately generic over content rather than template-specific, so every
 * narrative-style builder (acknowledgment, appointment lifecycle emails)
 * can reuse it without change.
 *
 * The CASL compliance footer (services/emailTemplates/complianceFooter.ts)
 * is a single "\n"-joined block starting with "—" — detected here and
 * rendered as a muted, separated block rather than a normal paragraph.
 *
 * `accentColor` defaults to DEFAULT_EMAIL_ACCENT_COLOR but callers should
 * pass the sending business's own (services/business.ts's
 * getEffectiveEmailAccentColor) so links and the header bar carry that
 * workspace's brand color.
 *
 * Always paired with the plain-text `body` as the multipart/alternative
 * fallback (services/gmail.ts's sendEmail) — this only needs to look good,
 * never needs to be the only version a client can render.
 */
export function renderEmailHtml(businessName: string, plainBody: string, accentColor: string = DEFAULT_EMAIL_ACCENT_COLOR): string {
  const paragraphs = plainBody.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const contentHtml = paragraphs
    .map((p, i) => {
      const isFooter = p.startsWith("—");
      const html = renderParagraph(p, isFooter, accentColor);
      return isFooter
        ? `<tr><td style="padding-top:20px;border-top:1px solid ${BORDER_COLOR};">${html}</td></tr>`
        : `<tr><td style="padding-bottom:${i === paragraphs.length - 1 ? "0" : "4px"};">${html}</td></tr>`;
    })
    .join("\n");

  return renderEmailShell(businessName, `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${contentHtml}</table>`, accentColor);
}
