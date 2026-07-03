import Airtable, { type FieldSet, type Record as AirtableRecord } from "airtable";
import { AIRTABLE_TABLES, ESTIMATE_FIELDS, FOLLOWUP_FIELDS } from "@/config/airtable";
import { OPEN_ESTIMATE_STATUSES } from "@/config/constants";
import { env } from "@/lib/env";
import { todayIso } from "@/lib/date";
import type {
  Estimate,
  EstimateStatus,
  FollowUp,
  FollowUpStatus,
  NewEstimateInput,
  NewFollowUpInput,
  UpdateEstimateInput,
  UpdateFollowUpInput,
} from "@/types";

function getBase() {
  return new Airtable({ apiKey: env.airtableApiKey }).base(env.airtableBaseId);
}

function toEstimate(record: AirtableRecord<FieldSet>): Estimate {
  return {
    id: record.id,
    customerName: (record.get(ESTIMATE_FIELDS.customerName) as string) ?? "",
    customerEmail: (record.get(ESTIMATE_FIELDS.customerEmail) as string) ?? "",
    businessName: (record.get(ESTIMATE_FIELDS.businessName) as string) ?? "",
    serviceType: (record.get(ESTIMATE_FIELDS.serviceType) as string) ?? "",
    estimateValue: (record.get(ESTIMATE_FIELDS.estimateValue) as number) ?? 0,
    dateSent: (record.get(ESTIMATE_FIELDS.dateSent) as string) ?? "",
    status: ((record.get(ESTIMATE_FIELDS.status) as EstimateStatus) ?? "Sent"),
    nextFollowUpDate: (record.get(ESTIMATE_FIELDS.nextFollowUpDate) as string) ?? null,
    lastContactDate: (record.get(ESTIMATE_FIELDS.lastContactDate) as string) ?? null,
    notes: (record.get(ESTIMATE_FIELDS.notes) as string) ?? "",
    gmailThreadId: (record.get(ESTIMATE_FIELDS.gmailThreadId) as string) ?? null,
    gmailLastMessageId: (record.get(ESTIMATE_FIELDS.gmailLastMessageId) as string) ?? null,
  };
}

function toFollowUp(record: AirtableRecord<FieldSet>): FollowUp {
  return {
    id: record.id,
    estimateId: (record.get(FOLLOWUP_FIELDS.estimateId) as string) ?? "",
    message: (record.get(FOLLOWUP_FIELDS.message) as string) ?? "",
    status: ((record.get(FOLLOWUP_FIELDS.status) as FollowUpStatus) ?? "Pending"),
    scheduledDate: (record.get(FOLLOWUP_FIELDS.scheduledDate) as string) ?? "",
    sentAt: (record.get(FOLLOWUP_FIELDS.sentAt) as string) ?? null,
  };
}

export async function getEstimates(): Promise<Estimate[]> {
  const records = await getBase()(AIRTABLE_TABLES.estimates)
    .select({ sort: [{ field: ESTIMATE_FIELDS.dateSent, direction: "desc" }] })
    .all();
  return records.map(toEstimate);
}

export async function getEstimate(id: string): Promise<Estimate | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.estimates).find(id);
    return toEstimate(record);
  } catch {
    return null;
  }
}

export async function createEstimate(input: NewEstimateInput): Promise<Estimate> {
  const record = await getBase()(AIRTABLE_TABLES.estimates).create({
    [ESTIMATE_FIELDS.customerName]: input.customerName,
    [ESTIMATE_FIELDS.customerEmail]: input.customerEmail,
    [ESTIMATE_FIELDS.businessName]: input.businessName ?? env.defaultBusinessName,
    [ESTIMATE_FIELDS.serviceType]: input.serviceType,
    [ESTIMATE_FIELDS.estimateValue]: input.estimateValue,
    [ESTIMATE_FIELDS.dateSent]: input.dateSent,
    [ESTIMATE_FIELDS.status]: input.status ?? "Sent",
    [ESTIMATE_FIELDS.nextFollowUpDate]: input.nextFollowUpDate ?? undefined,
    [ESTIMATE_FIELDS.lastContactDate]: input.lastContactDate ?? undefined,
    [ESTIMATE_FIELDS.notes]: input.notes ?? "",
  });
  return toEstimate(record);
}

export async function updateEstimate(id: string, input: UpdateEstimateInput): Promise<Estimate> {
  const fields: FieldSet = {};
  if (input.customerName !== undefined) fields[ESTIMATE_FIELDS.customerName] = input.customerName;
  if (input.customerEmail !== undefined) fields[ESTIMATE_FIELDS.customerEmail] = input.customerEmail;
  if (input.businessName !== undefined) fields[ESTIMATE_FIELDS.businessName] = input.businessName;
  if (input.serviceType !== undefined) fields[ESTIMATE_FIELDS.serviceType] = input.serviceType;
  if (input.estimateValue !== undefined) fields[ESTIMATE_FIELDS.estimateValue] = input.estimateValue;
  if (input.dateSent !== undefined) fields[ESTIMATE_FIELDS.dateSent] = input.dateSent;
  if (input.status !== undefined) fields[ESTIMATE_FIELDS.status] = input.status;
  if (input.nextFollowUpDate !== undefined) fields[ESTIMATE_FIELDS.nextFollowUpDate] = input.nextFollowUpDate ?? undefined;
  if (input.lastContactDate !== undefined) fields[ESTIMATE_FIELDS.lastContactDate] = input.lastContactDate ?? undefined;
  if (input.notes !== undefined) fields[ESTIMATE_FIELDS.notes] = input.notes;
  if (input.gmailThreadId !== undefined) fields[ESTIMATE_FIELDS.gmailThreadId] = input.gmailThreadId ?? undefined;
  if (input.gmailLastMessageId !== undefined) fields[ESTIMATE_FIELDS.gmailLastMessageId] = input.gmailLastMessageId ?? undefined;

  const record = await getBase()(AIRTABLE_TABLES.estimates).update(id, fields);
  return toEstimate(record);
}

/** Open estimates whose nextFollowUpDate has arrived (or passed). */
export async function getDueFollowUps(): Promise<Estimate[]> {
  const estimates = await getEstimates();
  const today = todayIso();
  return estimates.filter(
    (estimate) =>
      OPEN_ESTIMATE_STATUSES.includes(estimate.status) &&
      !!estimate.nextFollowUpDate &&
      estimate.nextFollowUpDate <= today
  );
}

export async function getFollowUps(): Promise<FollowUp[]> {
  const records = await getBase()(AIRTABLE_TABLES.followUps)
    .select({ sort: [{ field: FOLLOWUP_FIELDS.scheduledDate, direction: "desc" }] })
    .all();
  return records.map(toFollowUp);
}

export async function getFollowUpsForEstimate(estimateId: string): Promise<FollowUp[]> {
  const followUps = await getFollowUps();
  return followUps.filter((f) => f.estimateId === estimateId);
}

export async function getFollowUp(id: string): Promise<FollowUp | null> {
  try {
    const record = await getBase()(AIRTABLE_TABLES.followUps).find(id);
    return toFollowUp(record);
  } catch {
    return null;
  }
}

export async function createFollowUp(input: NewFollowUpInput): Promise<FollowUp> {
  const record = await getBase()(AIRTABLE_TABLES.followUps).create({
    [FOLLOWUP_FIELDS.estimateId]: input.estimateId,
    [FOLLOWUP_FIELDS.message]: input.message,
    [FOLLOWUP_FIELDS.status]: input.status ?? "Pending",
    [FOLLOWUP_FIELDS.scheduledDate]: input.scheduledDate,
  });
  return toFollowUp(record);
}

export async function updateFollowUp(id: string, input: UpdateFollowUpInput): Promise<FollowUp> {
  const fields: FieldSet = {};
  if (input.message !== undefined) fields[FOLLOWUP_FIELDS.message] = input.message;
  if (input.status !== undefined) fields[FOLLOWUP_FIELDS.status] = input.status;
  if (input.scheduledDate !== undefined) fields[FOLLOWUP_FIELDS.scheduledDate] = input.scheduledDate;
  if (input.sentAt !== undefined) fields[FOLLOWUP_FIELDS.sentAt] = input.sentAt ?? undefined;

  // typecast lets Airtable add "Failed" as a select option the first time it's written,
  // since the choices list can only be extended this way (not via the schema/meta API).
  const record = await getBase()(AIRTABLE_TABLES.followUps).update(id, fields, { typecast: true });
  return toFollowUp(record);
}
