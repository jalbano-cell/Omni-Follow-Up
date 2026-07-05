export type EmailTemplateKey = "acknowledgment" | "followup_1" | "followup_2" | "final_followup";

export interface EmailTemplate {
  key: EmailTemplateKey;
  subject: string;
  body: string;
  /** False when this is the built-in default (no override row exists yet for this business). */
  isCustomized: boolean;
  updatedAt: string | null;
}
