"use client";

import { useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Sparkles, Pencil, X, RotateCcw, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  dismissAiInsightsAction,
  restoreAiInsightsAction,
  updateAiInsightsAction,
  regenerateAiInsightsAction,
} from "@/app/leads/actions";
import type { LeadAiInsights } from "@/services/leadService";

const PRIORITY_BADGE_VARIANT: Record<string, "destructive" | "warning" | "secondary"> = {
  High: "destructive",
  Medium: "warning",
  Low: "secondary",
};

const URGENCY_BADGE_VARIANT: Record<string, "destructive" | "warning" | "secondary" | "outline"> = {
  Today: "destructive",
  "24 hours": "warning",
  "3 days": "secondary",
  "1 week": "outline",
};

interface FormState {
  category: string;
  priority: string;
  priorityReason: string;
  opportunityValueRange: string;
  opportunityConfidence: string;
  suggestedNextAction: string;
  responseUrgency: string;
  responseUrgencyReason: string;
}

function toFormState(insights: LeadAiInsights): FormState {
  return {
    category: insights.category ?? "",
    priority: insights.priority ?? "",
    priorityReason: insights.priorityReason ?? "",
    opportunityValueRange: insights.opportunityValueRange ?? "",
    opportunityConfidence: insights.opportunityConfidence ?? "",
    suggestedNextAction: insights.suggestedNextAction ?? "",
    responseUrgency: insights.responseUrgency ?? "",
    responseUrgencyReason: insights.responseUrgencyReason ?? "",
  };
}

export function AiInsightsCard({ leadId, insights }: { leadId: string; insights: LeadAiInsights }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<FormState>(() => toFormState(insights));
  const [isPending, startTransition] = useTransition();

  function field(key: keyof FormState) {
    return (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function save() {
    startTransition(async () => {
      await updateAiInsightsAction(leadId, {
        aiCategory: form.category,
        aiPriority: (form.priority || null) as LeadAiInsights["priority"],
        aiPriorityReason: form.priorityReason,
        aiOpportunityValueRange: form.opportunityValueRange,
        aiOpportunityConfidence: form.opportunityConfidence,
        suggestedNextAction: form.suggestedNextAction,
        aiResponseUrgency: (form.responseUrgency || null) as LeadAiInsights["responseUrgency"],
        aiResponseUrgencyReason: form.responseUrgencyReason,
      });
      setIsEditing(false);
      toast.success("AI recommendations updated");
    });
  }

  function dismiss() {
    startTransition(async () => {
      await dismissAiInsightsAction(leadId);
      toast.success("AI recommendations dismissed");
    });
  }

  function restore() {
    startTransition(async () => {
      await restoreAiInsightsAction(leadId);
      toast.success("AI recommendations restored");
    });
  }

  function regenerate() {
    startTransition(async () => {
      await regenerateAiInsightsAction(leadId);
      setForm(toFormState(insights));
      toast.success("Re-analyzed lead");
    });
  }

  if (insights.status === "pending") {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Sparkles className="size-4 animate-pulse" />
        Analyzing this lead…
      </div>
    );
  }

  if (insights.status === "failed") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <p className="text-sm text-muted-foreground">AI analysis failed to complete for this lead.</p>
        <Button variant="outline" size="sm" onClick={regenerate} disabled={isPending}>
          <RotateCcw className="size-3.5" />
          Try again
        </Button>
      </div>
    );
  }

  if (insights.status === "dismissed") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <Badge variant="secondary">Dismissed</Badge>
        <p className="text-sm text-muted-foreground">AI recommendations are hidden for this lead.</p>
        <Button variant="outline" size="sm" onClick={restore} disabled={isPending}>
          Restore
        </Button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <Label htmlFor="ai-category">Category</Label>
          <Input id="ai-category" value={form.category} onChange={field("category")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ai-priority">Priority</Label>
          <Input
            id="ai-priority"
            value={form.priority}
            onChange={field("priority")}
            placeholder="High / Medium / Low"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ai-priority-reason">Priority reason</Label>
          <Textarea id="ai-priority-reason" rows={2} value={form.priorityReason} onChange={field("priorityReason")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ai-value-range">Estimated opportunity value</Label>
          <Input id="ai-value-range" value={form.opportunityValueRange} onChange={field("opportunityValueRange")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ai-value-confidence">Opportunity confidence</Label>
          <Textarea id="ai-value-confidence" rows={2} value={form.opportunityConfidence} onChange={field("opportunityConfidence")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ai-next-action">Suggested next action</Label>
          <Input id="ai-next-action" value={form.suggestedNextAction} onChange={field("suggestedNextAction")} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="ai-urgency">Response urgency</Label>
          <Input
            id="ai-urgency"
            value={form.responseUrgency}
            onChange={field("responseUrgency")}
            placeholder="Today / 24 hours / 3 days / 1 week"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="ai-urgency-reason">Response urgency reason</Label>
          <Textarea id="ai-urgency-reason" rows={2} value={form.responseUrgencyReason} onChange={field("responseUrgencyReason")} className="mt-1" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => { setForm(toFormState(insights)); setIsEditing(false); }} disabled={isPending}>
            <X className="size-3.5" />
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={isPending}>
            Save
          </Button>
        </div>
      </div>
    );
  }

  const rows: Array<[string, ReactNode]> = [
    ["Summary", insights.summary],
    [
      "Priority",
      insights.priority && (
        <div className="flex flex-col gap-1">
          <Badge variant={PRIORITY_BADGE_VARIANT[insights.priority] ?? "secondary"}>{insights.priority}</Badge>
          {insights.priorityReason && <span className="text-xs text-muted-foreground">{insights.priorityReason}</span>}
        </div>
      ),
    ],
    ["Category", insights.category],
    [
      "Estimated opportunity value",
      (insights.opportunityValueRange || insights.opportunityConfidence) && (
        <div className="flex flex-col gap-1">
          {insights.opportunityValueRange && <span>{insights.opportunityValueRange}</span>}
          {insights.opportunityConfidence && <span className="text-xs text-muted-foreground">{insights.opportunityConfidence}</span>}
        </div>
      ),
    ],
    ["Suggested next action", insights.suggestedNextAction],
    [
      "Response urgency",
      insights.responseUrgency && (
        <div className="flex flex-col gap-1">
          <Badge variant={URGENCY_BADGE_VARIANT[insights.responseUrgency] ?? "secondary"}>{insights.responseUrgency}</Badge>
          {insights.responseUrgencyReason && <span className="text-xs text-muted-foreground">{insights.responseUrgencyReason}</span>}
        </div>
      ),
    ],
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground" />
          {insights.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Generated {new Date(insights.generatedAt).toLocaleString("en-US", { timeZone: "America/Toronto" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} disabled={isPending}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={regenerate} disabled={isPending}>
            <RotateCcw className="size-3.5" />
            Regenerate
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={isPending}>
            <EyeOff className="size-3.5" />
            Dismiss
          </Button>
        </div>
      </div>
      <dl className="flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-sm text-foreground">{value || <span className="text-foreground/50 italic">Not available</span>}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
