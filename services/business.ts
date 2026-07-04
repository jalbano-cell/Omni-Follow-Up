import Airtable, { type FieldSet, type Record as AirtableRecord } from "airtable";
import { AIRTABLE_TABLES, BUSINESS_FIELDS } from "@/config/airtable";
import { DEFAULT_FOLLOW_UP_CADENCE_DAYS } from "@/config/constants";
import { env } from "@/lib/env";
import type { Business, NewBusinessInput, UpdateBusinessInput } from "@/types";

function getBase() {
  return new Airtable({ apiKey: env.airtableApiKey }).base(env.airtableBaseId);
}

function toBusiness(record: AirtableRecord<FieldSet>): Business {
  return {
    id: record.id,
    businessName: (record.get(BUSINESS_FIELDS.businessName) as string) ?? "",
    ownerName: (record.get(BUSINESS_FIELDS.ownerName) as string) ?? "",
    ownerEmail: (record.get(BUSINESS_FIELDS.ownerEmail) as string) ?? "",
    passwordHash: (record.get(BUSINESS_FIELDS.passwordHash) as string) ?? "",
    followUpCadenceSentDays: (record.get(BUSINESS_FIELDS.followUpCadenceSentDays) as number) ?? null,
    followUpCadenceFollowUp1Days: (record.get(BUSINESS_FIELDS.followUpCadenceFollowUp1Days) as number) ?? null,
    followUpCadenceFollowUp2Days: (record.get(BUSINESS_FIELDS.followUpCadenceFollowUp2Days) as number) ?? null,
    onboardingCompletedAt: (record.get(BUSINESS_FIELDS.onboardingCompletedAt) as string) ?? null,
    createdAt: (record.get(BUSINESS_FIELDS.createdAt) as string) ?? "",
  };
}

/** Escapes single quotes for safe interpolation into an Airtable filterByFormula string. */
function escapeFormulaValue(value: string): string {
  return value.replace(/'/g, "\\'");
}

export async function getBusinessById(id: string): Promise<Business | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.businesses).find(id);
    return toBusiness(record);
  } catch {
    return null;
  }
}

export async function getBusinessByEmail(email: string): Promise<Business | null> {
  const records = await getBase()(AIRTABLE_TABLES.businesses)
    .select({
      filterByFormula: `LOWER({${BUSINESS_FIELDS.ownerEmail}}) = '${escapeFormulaValue(email.toLowerCase())}'`,
      maxRecords: 1,
    })
    .all();
  return records[0] ? toBusiness(records[0]) : null;
}

export async function createBusiness(input: NewBusinessInput): Promise<Business> {
  const record = await getBase()(AIRTABLE_TABLES.businesses).create({
    [BUSINESS_FIELDS.businessName]: input.businessName,
    [BUSINESS_FIELDS.ownerName]: input.ownerName,
    [BUSINESS_FIELDS.ownerEmail]: input.ownerEmail,
    [BUSINESS_FIELDS.passwordHash]: input.passwordHash,
    [BUSINESS_FIELDS.createdAt]: new Date().toISOString(),
  });
  return toBusiness(record);
}

export async function updateBusiness(id: string, input: UpdateBusinessInput): Promise<Business> {
  const fields: FieldSet = {};
  if (input.businessName !== undefined) fields[BUSINESS_FIELDS.businessName] = input.businessName;
  if (input.ownerName !== undefined) fields[BUSINESS_FIELDS.ownerName] = input.ownerName;
  if (input.ownerEmail !== undefined) fields[BUSINESS_FIELDS.ownerEmail] = input.ownerEmail;
  if (input.passwordHash !== undefined) fields[BUSINESS_FIELDS.passwordHash] = input.passwordHash;
  if (input.followUpCadenceSentDays !== undefined)
    fields[BUSINESS_FIELDS.followUpCadenceSentDays] = input.followUpCadenceSentDays ?? undefined;
  if (input.followUpCadenceFollowUp1Days !== undefined)
    fields[BUSINESS_FIELDS.followUpCadenceFollowUp1Days] = input.followUpCadenceFollowUp1Days ?? undefined;
  if (input.followUpCadenceFollowUp2Days !== undefined)
    fields[BUSINESS_FIELDS.followUpCadenceFollowUp2Days] = input.followUpCadenceFollowUp2Days ?? undefined;
  if (input.onboardingCompletedAt !== undefined)
    fields[BUSINESS_FIELDS.onboardingCompletedAt] = input.onboardingCompletedAt ?? undefined;

  const record = await getBase()(AIRTABLE_TABLES.businesses).update(id, fields);
  return toBusiness(record);
}

/** Every business, for the per-tenant cron loop (follow-up drafting). */
export async function getAllActiveBusinesses(): Promise<Business[]> {
  const records = await getBase()(AIRTABLE_TABLES.businesses).select().all();
  return records.map(toBusiness);
}

/** Resolves the effective follow-up cadence for a business, filling gaps with the global defaults. */
export function getEffectiveCadenceDays(
  business: Pick<Business, "followUpCadenceSentDays" | "followUpCadenceFollowUp1Days" | "followUpCadenceFollowUp2Days">
): Record<"Sent" | "Follow-up 1" | "Follow-up 2", number> {
  return {
    Sent: business.followUpCadenceSentDays ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS.Sent,
    "Follow-up 1": business.followUpCadenceFollowUp1Days ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS["Follow-up 1"],
    "Follow-up 2": business.followUpCadenceFollowUp2Days ?? DEFAULT_FOLLOW_UP_CADENCE_DAYS["Follow-up 2"],
  };
}
