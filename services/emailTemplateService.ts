import { insertRow, updateRow, deleteRow, selectWhere } from "@/lib/supabase";
import { renderTemplate, sampleMergeVariables } from "@/services/emailTemplates/render";
import { EMAIL_TEMPLATE_KEYS } from "@/config/constants";
import type { Database } from "@/types/supabase";
import type { EmailTemplate, EmailTemplateKey, EstimateStatus } from "@/types";

export { renderTemplate, sampleMergeVariables };

/**
 * Customer-facing email copy a business can override — one row per
 * (workspace, template_key) in the `email_templates` table. No row means
 * "use the built-in default" below; this is the same nullable-override
 * pattern services/business.ts uses for cadence/timezone/etc, just backed
 * by its own table instead of a column, since there are 4 named slots.
 */
const FOLLOW_UP_SUBJECT = "Your {{service}} estimate from {{business_name}}";

const DEFAULT_TEMPLATES: Record<EmailTemplateKey, { subject: string; body: string }> = {
  acknowledgment: {
    subject: "We received your message",
    body: [
      "Hi {{customer_name}}, thanks for reaching out to {{business_name}} about {{service}} — we've received your message and wanted to confirm it's on our radar.",
      "We'll follow up with you shortly. In the meantime, feel free to reply to this email if you'd like to add anything.",
    ].join("\n\n"),
  },
  followup_1: {
    subject: FOLLOW_UP_SUBJECT,
    body: "Hi {{customer_name}}, just checking in on the {{service}} estimate ({{estimate_value}}) we sent {{days_since}} days ago. Happy to answer any questions or adjust the scope — want to get this booked in?",
  },
  followup_2: {
    subject: FOLLOW_UP_SUBJECT,
    body: "Hi {{customer_name}}, following up again on your {{service}} estimate. We can typically get started within the next week if you're ready to move forward. Let me know if you'd like to schedule it.",
  },
  final_followup: {
    subject: FOLLOW_UP_SUBJECT,
    body: "Hi {{customer_name}}, I don't want to keep bothering you, but wanted to check one last time if you're still interested in the {{service}} work ({{estimate_value}}). If timing isn't right, no worries — just let me know and I'll close this out.",
  },
};

/** Which template a follow-up draft/send uses, keyed by the Estimate's current stage. */
export function templateKeyForEstimateStage(status: EstimateStatus): EmailTemplateKey {
  if (status === "Sent") return "followup_1";
  if (status === "Follow-up 1") return "followup_2";
  return "final_followup"; // "Follow-up 2" — the last automated stage
}

type EmailTemplateRow = Database["public"]["Tables"]["email_templates"]["Row"];

function toEmailTemplate(key: EmailTemplateKey, row: EmailTemplateRow | undefined): EmailTemplate {
  if (row) {
    return { key, subject: row.subject, body: row.body, isCustomized: true, updatedAt: row.updated_at };
  }
  const def = DEFAULT_TEMPLATES[key];
  return { key, subject: def.subject, body: def.body, isCustomized: false, updatedAt: null };
}

export async function getEmailTemplate(businessId: string, key: EmailTemplateKey): Promise<EmailTemplate> {
  const rows = await selectWhere("email_templates", { workspace_id: businessId, template_key: key });
  return toEmailTemplate(key, rows[0]);
}

/** All 4 templates for a business, each merged with its default if uncustomized — what the Settings UI lists. */
export async function listEmailTemplates(businessId: string): Promise<EmailTemplate[]> {
  const rows = await selectWhere("email_templates", { workspace_id: businessId });
  const byKey = new Map(rows.map((row) => [row.template_key as EmailTemplateKey, row]));
  return EMAIL_TEMPLATE_KEYS.map((key) => toEmailTemplate(key, byKey.get(key)));
}

export async function upsertEmailTemplate(
  businessId: string,
  key: EmailTemplateKey,
  input: { subject: string; body: string }
): Promise<EmailTemplate> {
  const rows = await selectWhere("email_templates", { workspace_id: businessId, template_key: key });
  const existing = rows[0];

  const row = existing
    ? await updateRow("email_templates", existing.id, {
        subject: input.subject,
        body: input.body,
        updated_at: new Date().toISOString(),
      })
    : await insertRow("email_templates", {
        workspace_id: businessId,
        template_key: key,
        subject: input.subject,
        body: input.body,
      });

  return toEmailTemplate(key, row);
}

/** Removes the override row, reverting to the built-in default. */
export async function resetEmailTemplate(businessId: string, key: EmailTemplateKey): Promise<EmailTemplate> {
  const rows = await selectWhere("email_templates", { workspace_id: businessId, template_key: key });
  if (rows[0]) {
    await deleteRow("email_templates", rows[0].id);
  }
  return toEmailTemplate(key, undefined);
}
