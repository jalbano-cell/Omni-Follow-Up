import Airtable, { type FieldSet, type Record as AirtableRecord } from "airtable";
import { AIRTABLE_TABLES, BUSINESS_FIELDS } from "@/config/airtable";
import {
  APP_TIMEZONE,
  CALENDAR_REMINDER_HOUR,
  DEFAULT_FOLLOW_UP_CADENCE_DAYS,
  DEFAULT_WORKING_HOURS_END,
} from "@/config/constants";
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
    onboardingStep: (record.get(BUSINESS_FIELDS.onboardingStep) as number) ?? 0,
    onboardingCompletedAt: (record.get(BUSINESS_FIELDS.onboardingCompletedAt) as string) ?? null,
    googleRefreshTokenEnc: (record.get(BUSINESS_FIELDS.googleRefreshTokenEnc) as string) ?? null,
    googleConnectedEmail: (record.get(BUSINESS_FIELDS.googleConnectedEmail) as string) ?? null,
    googleScopes: (record.get(BUSINESS_FIELDS.googleScopes) as string) ?? null,
    googleConnectedAt: (record.get(BUSINESS_FIELDS.googleConnectedAt) as string) ?? null,
    calendarId: (record.get(BUSINESS_FIELDS.calendarId) as string) ?? null,
    industry: (record.get(BUSINESS_FIELDS.industry) as string) ?? null,
    timezone: (record.get(BUSINESS_FIELDS.timezone) as string) ?? null,
    workingHoursStart: (record.get(BUSINESS_FIELDS.workingHoursStart) as number) ?? null,
    workingHoursEnd: (record.get(BUSINESS_FIELDS.workingHoursEnd) as number) ?? null,
    emailSignature: (record.get(BUSINESS_FIELDS.emailSignature) as string) ?? null,
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
  if (input.onboardingStep !== undefined) fields[BUSINESS_FIELDS.onboardingStep] = input.onboardingStep;
  if (input.onboardingCompletedAt !== undefined)
    fields[BUSINESS_FIELDS.onboardingCompletedAt] = input.onboardingCompletedAt ?? undefined;
  if (input.googleRefreshTokenEnc !== undefined)
    fields[BUSINESS_FIELDS.googleRefreshTokenEnc] = input.googleRefreshTokenEnc ?? undefined;
  if (input.googleConnectedEmail !== undefined)
    fields[BUSINESS_FIELDS.googleConnectedEmail] = input.googleConnectedEmail ?? undefined;
  if (input.googleScopes !== undefined) fields[BUSINESS_FIELDS.googleScopes] = input.googleScopes ?? undefined;
  if (input.googleConnectedAt !== undefined)
    fields[BUSINESS_FIELDS.googleConnectedAt] = input.googleConnectedAt ?? undefined;
  if (input.calendarId !== undefined) fields[BUSINESS_FIELDS.calendarId] = input.calendarId ?? undefined;
  if (input.industry !== undefined) fields[BUSINESS_FIELDS.industry] = input.industry ?? undefined;
  if (input.timezone !== undefined) fields[BUSINESS_FIELDS.timezone] = input.timezone ?? undefined;
  if (input.workingHoursStart !== undefined)
    fields[BUSINESS_FIELDS.workingHoursStart] = input.workingHoursStart ?? undefined;
  if (input.workingHoursEnd !== undefined)
    fields[BUSINESS_FIELDS.workingHoursEnd] = input.workingHoursEnd ?? undefined;
  if (input.emailSignature !== undefined) fields[BUSINESS_FIELDS.emailSignature] = input.emailSignature ?? undefined;

  const record = await getBase()(AIRTABLE_TABLES.businesses).update(id, fields);
  return toBusiness(record);
}

/** Persists a freshly-connected (or reconnected) Google account's tokens/scopes. */
export async function saveGoogleConnection(
  id: string,
  input: { encryptedRefreshToken: string; connectedEmail: string; scopes: string }
): Promise<Business> {
  return updateBusiness(id, {
    googleRefreshTokenEnc: input.encryptedRefreshToken,
    googleConnectedEmail: input.connectedEmail,
    googleScopes: input.scopes,
    googleConnectedAt: new Date().toISOString(),
  });
}

/** Clears a Google connection — used when a refresh token is revoked (invalid_grant) and needs reconnecting. */
export async function clearGoogleConnection(id: string): Promise<Business> {
  return updateBusiness(id, {
    googleRefreshTokenEnc: null,
    googleConnectedEmail: null,
    googleScopes: null,
    googleConnectedAt: null,
  });
}

export async function markOnboardingStep(id: string, step: number): Promise<Business> {
  return updateBusiness(id, { onboardingStep: step });
}

export async function completeOnboarding(id: string): Promise<Business> {
  return updateBusiness(id, { onboardingCompletedAt: new Date().toISOString() });
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

/** Which calendar Calendar reminders get created on — "primary" (the connected account's main calendar) unless overridden. */
export function getEffectiveCalendarId(business: Pick<Business, "calendarId">): string {
  return business.calendarId ?? "primary";
}

/** The business's own timezone for Calendar reminder times, falling back to the app-wide default when unset. */
export function getEffectiveTimezone(business: Pick<Business, "timezone">): string {
  return business.timezone ?? APP_TIMEZONE;
}

/** The business's own working-hours window (hour-of-day, 0-23), falling back to the app-wide defaults when unset. */
export function getEffectiveWorkingHours(
  business: Pick<Business, "workingHoursStart" | "workingHoursEnd">
): { start: number; end: number } {
  return {
    start: business.workingHoursStart ?? CALENDAR_REMINDER_HOUR,
    end: business.workingHoursEnd ?? DEFAULT_WORKING_HOURS_END,
  };
}
