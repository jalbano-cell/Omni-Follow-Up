import { formatDate } from "@/lib/date";
import type { ActivityLogEntry } from "@/types";

/** Chronological trail of everything that's happened to this lead — created/converted/archived/assigned/noted. */
export function LeadTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="text-sm text-foreground">{entry.description}</p>
            <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
