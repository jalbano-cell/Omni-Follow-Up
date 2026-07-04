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
