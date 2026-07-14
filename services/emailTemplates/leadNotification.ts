import { escapeHtml, renderEmailShell, ACCENT_COLOR, TEXT_COLOR, MUTED_COLOR, BORDER_COLOR } from "@/services/emailTemplates/emailLayout";
import { buildAbsoluteUrl } from "@/lib/url";
import type { Business, Lead } from "@/types";

export interface LeadNotificationEmail {
  subject: string;
  body: string;
  html: string;
}

/**
 * The owner-facing "New Website Inquiry" notification (services/leadService.ts's
 * sendLeadNotificationEmail) — unlike the narrative, paragraph-shaped customer
 * emails services/emailTemplates/emailLayout.ts's renderEmailHtml is built
 * for, this is a data dump the owner needs to scan fast, so it gets its own
 * label/value table + a distinct "message" callout instead of being forced
 * through the generic paragraph renderer. Still shares that file's shell
 * (renderEmailShell) and color tokens for a consistent look.
 */
export function buildLeadNotificationEmail(business: Business, lead: Lead, appHost: string): LeadNotificationEmail {
  const fields: Array<[string, string]> = [
    ["Name", lead.name],
    ["Email", lead.email],
    ...(lead.phone ? ([["Phone", lead.phone]] as Array<[string, string]>) : []),
    ...(lead.company ? ([["Company", lead.company]] as Array<[string, string]>) : []),
    ["Requested service", lead.requestedService || "Not specified"],
    ["Submitted", new Date(lead.createdTime).toLocaleString("en-US", { timeZone: "America/Toronto" })],
    ["Lead ID", lead.leadId],
  ];

  const body = [
    `New website inquiry for ${business.businessName}`,
    fields.map(([label, value]) => `${label}: ${value}`).join("\n"),
    `Message:\n${lead.message}`,
    `View this lead: ${buildAbsoluteUrl(appHost, `/leads/${lead.id}`)}`,
  ].join("\n\n");

  const rowsHtml = fields
    .map(
      ([label, value], i) => `
      <tr>
        <td style="padding:10px 0;${i > 0 ? `border-top:1px solid ${BORDER_COLOR};` : ""}font-size:13px;color:${MUTED_COLOR};white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
        <td style="padding:10px 0 10px 16px;${i > 0 ? `border-top:1px solid ${BORDER_COLOR};` : ""}font-size:14px;color:${TEXT_COLOR};font-weight:500;text-align:right;">${escapeHtml(value)}</td>
      </tr>`
    )
    .join("");

  const leadUrl = buildAbsoluteUrl(appHost, `/leads/${lead.id}`);

  const html = renderEmailShell(
    business.businessName,
    `
    <p style="margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;color:${ACCENT_COLOR};">New website inquiry</p>
    <p style="margin:0 0 20px;font-size:20px;font-weight:600;color:${TEXT_COLOR};">${escapeHtml(lead.name)}</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      ${rowsHtml}
    </table>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F4F5;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.02em;color:${MUTED_COLOR};">Message</p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:${TEXT_COLOR};white-space:pre-wrap;">${escapeHtml(lead.message)}</p>
        </td>
      </tr>
    </table>

    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="border-radius:8px;background-color:${ACCENT_COLOR};">
          <a href="${leadUrl}" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">View lead &rarr;</a>
        </td>
      </tr>
    </table>
    `
  );

  return { subject: "New Website Inquiry", body, html };
}
