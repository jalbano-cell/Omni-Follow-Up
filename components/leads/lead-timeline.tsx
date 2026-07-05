import {
  Inbox,
  Send,
  MailWarning,
  CalendarCheck,
  CalendarClock,
  Archive,
  Undo2,
  UserCheck,
  StickyNote,
  FileText,
  Sparkles,
  EyeOff,
  Eye,
  Pencil,
  CheckCircle2,
  MessageSquare,
  PartyPopper,
  XCircle,
  Circle,
  type LucideIcon,
} from "lucide-react";
import { formatDate } from "@/lib/date";
import type { ActivityLogEntry } from "@/types";

/** Icon + color per activity type — anything not listed falls back to a plain dot, same as before this mapping existed. */
const TIMELINE_ICON: Record<string, { icon: LucideIcon; className: string }> = {
  "lead.created": { icon: Inbox, className: "text-primary" },
  "lead.acknowledgment_sent": { icon: Send, className: "text-primary" },
  "lead.acknowledgment_failed": { icon: MailWarning, className: "text-destructive" },
  "lead.appointment_booked": { icon: CalendarCheck, className: "text-success" },
  "lead.appointment_alternates_offered": { icon: CalendarClock, className: "text-warning-foreground" },
  "lead.appointment_recommended": { icon: CalendarClock, className: "text-warning-foreground" },
  "lead.appointment_dismissed": { icon: Archive, className: "text-muted-foreground" },
  "lead.archived": { icon: Archive, className: "text-muted-foreground" },
  "lead.conversion_reverted": { icon: Undo2, className: "text-warning-foreground" },
  "lead.assigned": { icon: UserCheck, className: "text-primary" },
  "lead.note_added": { icon: StickyNote, className: "text-muted-foreground" },
  "lead.converted": { icon: FileText, className: "text-success" },
  "lead.ai_analyzed": { icon: Sparkles, className: "text-primary" },
  "lead.ai_dismissed": { icon: EyeOff, className: "text-muted-foreground" },
  "lead.ai_restored": { icon: Eye, className: "text-muted-foreground" },
  "lead.ai_edited": { icon: Pencil, className: "text-muted-foreground" },
  "estimate.followup_approved": { icon: CheckCircle2, className: "text-primary" },
  "estimate.followup_sent": { icon: Send, className: "text-primary" },
  "estimate.reply_received": { icon: MessageSquare, className: "text-primary" },
  "estimate.booked": { icon: PartyPopper, className: "text-success" },
  "estimate.lost": { icon: XCircle, className: "text-destructive" },
};

const DEFAULT_ICON = { icon: Circle, className: "text-muted-foreground fill-current" };

/** Chronological trail of everything that's happened to this lead — created/converted/archived/assigned/noted, plus what happened to its estimate once converted. */
export function LeadTimeline({ entries }: { entries: ActivityLogEntry[] }) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No activity recorded yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) => {
        const { icon: Icon, className } = TIMELINE_ICON[entry.type] ?? DEFAULT_ICON;
        return (
          <li key={entry.id} className="flex gap-3">
            <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} strokeWidth={2} />
            <div className="min-w-0">
              <p className="text-sm text-foreground">{entry.description}</p>
              <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
