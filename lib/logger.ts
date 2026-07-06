import { promises as fs } from "fs";
import path from "path";

const DAILY_RUN_LOG_DIR = path.join(process.cwd(), "logs", "daily-run");

export interface DailyRunLog {
  timestamp: string;
  /** Present when the run is scoped to one business (the per-tenant cron loop). */
  businessId?: string;
  estimatesChecked: number;
  followUpsCreated: number;
  errors: string[];
}

/**
 * Records a daily follow-up run. Always logs to console (the durable record
 * on Vercel, where the filesystem is read-only in production) and best-effort
 * writes a JSON file under /logs/daily-run for local inspection.
 */
export async function writeDailyRunLog(log: DailyRunLog): Promise<void> {
  console.log(
    `[daily-run] ${log.timestamp}${log.businessId ? ` business=${log.businessId}` : ""} checked=${log.estimatesChecked} created=${log.followUpsCreated} errors=${log.errors.length}`,
    log.errors.length ? log.errors : ""
  );

  try {
    await fs.mkdir(DAILY_RUN_LOG_DIR, { recursive: true });
    const suffix = log.businessId ? `-${log.businessId}` : "";
    const filename = `${log.timestamp.slice(0, 10)}${suffix}.json`;
    await fs.writeFile(path.join(DAILY_RUN_LOG_DIR, filename), JSON.stringify(log, null, 2));
  } catch {
    // Production filesystems (e.g. Vercel) are read-only outside /tmp — the console line above is the record there.
  }
}

/** Lightweight audit trail for manual actions on estimates and follow-ups. */
export function logAction(action: string, detail: Record<string, unknown>): void {
  console.log(`[action] ${new Date().toISOString()} ${action}`, detail);
}

/**
 * Partially masks an email for logs — keeps the first character of the local
 * part and the full domain (`j***@acme.com`) so a failed submission is still
 * traceable/contactable, without dumping a harvestable address into Vercel's
 * log retention. Empty/malformed input passes through unchanged (nothing to leak).
 */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const masked = local.length <= 1 ? local : `${local[0]}***`;
  return `${masked}${email.slice(at)}`;
}

/** Masks a phone number for logs — keeps only the last 4 digits (`***1234`). */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 4) return phone ? "***" : phone;
  return `***${digits.slice(-4)}`;
}

const INTAKE_LOG_DIR = path.join(process.cwd(), "logs", "intake");

export type IntakeAuditResult =
  | "success"
  | "invalid_api_key"
  | "rate_limited"
  | "spam_blocked"
  | "validation_failed"
  | "plan_limit_exceeded"
  | "db_failed";

export interface IntakeAuditEntry {
  timestamp: string;
  businessId: string | null;
  ip: string | null;
  userAgent: string | null;
  source: string;
  result: IntakeAuditResult;
  detail?: Record<string, unknown>;
}

/**
 * Durable-as-possible record of every POST /api/intake attempt, independent
 * of the database — this must still work when the database write itself
 * fails, since "log the failure, don't lose the submission" is the whole point.
 * Always logs to console (captured by Vercel's function logs in production)
 * and best-effort appends one JSON line per attempt under /logs/intake for
 * local inspection, mirroring writeDailyRunLog's fallback-write pattern.
 */
export async function logIntakeAudit(entry: IntakeAuditEntry): Promise<void> {
  console.log(
    `[intake] ${entry.timestamp} business=${entry.businessId ?? "unknown"} ip=${entry.ip ?? "?"} result=${entry.result}`,
    entry.detail ?? ""
  );

  try {
    await fs.mkdir(INTAKE_LOG_DIR, { recursive: true });
    const filename = `${entry.timestamp.slice(0, 10)}.jsonl`;
    await fs.appendFile(path.join(INTAKE_LOG_DIR, filename), `${JSON.stringify(entry)}\n`);
  } catch {
    // Production filesystems (e.g. Vercel) are read-only outside /tmp — the console line above is the record there.
  }
}
