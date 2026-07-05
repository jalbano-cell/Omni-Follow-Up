import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { LeadAiInsights } from "@/services/leadService";

/**
 * STEP 9 placeholder UI — every Lead already carries the AI fields
 * (aiSummary/priorityScore/suggestedNextAction/suggestedFollowUpTiming, see
 * config/airtable.ts's LEAD_FIELDS), so this card just needs to start
 * rendering real values once services/leadService.ts's
 * getAiInsightsPlaceholder is replaced with a real model call — no schema
 * or page change needed then.
 */
export function AiInsightsCard({ insights }: { insights: LeadAiInsights }) {
  const rows: Array<[string, string]> = [
    ["Summary", insights.summary ?? "Not yet available"],
    ["Priority score", insights.priorityScore !== null ? String(insights.priorityScore) : "Not yet available"],
    ["Suggested next action", insights.suggestedNextAction ?? "Not yet available"],
    ["Suggested follow-up timing", insights.suggestedFollowUpTiming ?? "Not yet available"],
  ];

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4 text-muted-foreground" />
        <Badge variant="secondary">Coming soon</Badge>
      </div>
      <dl className="flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm text-foreground/70 italic">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
