import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { LeadNotes } from "@/components/leads/lead-notes";
import { AiInsightsCard } from "@/components/leads/ai-insights-card";
import { StatusBadge } from "@/components/estimates/status-badge";
import { FollowUpStatusBadge } from "@/components/follow-ups/follow-up-status-badge";
import { ReplyHistoryItem } from "@/components/replies/reply-history-item";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getLeadDetail } from "@/services/leadService";
import { ACTIONABLE_FOLLOWUP_STATUSES } from "@/config/constants";
import { formatCurrency, formatDate } from "@/lib/date";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { id: businessId } = await requireOnboardedBusiness();

  let detail;
  try {
    detail = await getLeadDetail(businessId, id);
  } catch (error) {
    return <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />;
  }

  if (!detail) notFound();
  const { lead, timeline, linkedEstimate, conversation, upcomingFollowUps, aiInsights } = detail;

  const contactInfo: Array<[string, string]> = [
    ["Lead ID", lead.leadId],
    ["Email", lead.email],
    ["Phone", lead.phone || "—"],
    ["Company", lead.company || "—"],
    ["Lead source", lead.leadSource],
    ["Created", formatDate(lead.createdTime)],
    ["Last activity", lead.lastActivityAt ? formatDate(lead.lastActivityAt) : "—"],
    ["Assigned to", lead.assignedTo || "Unassigned"],
  ];

  const futureFollowUps = upcomingFollowUps.filter((f) => ACTIONABLE_FOLLOWUP_STATUSES.includes(f.status));

  return (
    <>
      <Link
        href="/leads"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to leads
      </Link>

      <PageHeader
        title={lead.name}
        description={lead.requestedService ? `${lead.requestedService} · ${lead.email}` : lead.email}
        action={
          <div className="flex items-center gap-2">
            <LeadStatusBadge status={lead.status} />
            <LeadRowActions lead={lead} showView={false} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="py-5 lg:col-span-2">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Contact info</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {contactInfo.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Estimate status</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {linkedEstimate ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <StatusBadge status={linkedEstimate.status} />
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(linkedEstimate.estimateValue)}
                  </span>
                </div>
                <Button variant="outline" size="sm" render={<Link href={`/estimates/${linkedEstimate.id}`} />}>
                  View estimate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">Not yet converted to an estimate.</p>
                {lead.status === "New Inquiry" && (
                  <Button size="sm" render={<Link href={`/estimates/new?fromLead=${lead.id}`} />}>
                    Convert to Estimate
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          <div className="border-b border-border pb-4">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-muted-foreground">
                {lead.name} · {formatDate(lead.createdTime)}
              </span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">{lead.message}</p>
          </div>
          {conversation.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {linkedEstimate
                ? "No replies yet on the follow-up thread for this lead's estimate."
                : "Convert this lead to an estimate to start a follow-up email thread."}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {conversation.map((reply) => (
                <ReplyHistoryItem key={reply.id} reply={reply} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Future follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            {futureFollowUps.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {linkedEstimate
                  ? "Nothing scheduled — the follow-up engine will draft one once due."
                  : "Convert this lead to an estimate to start scheduling follow-ups."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {futureFollowUps.map((followUp) => (
                  <li key={followUp.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm text-foreground">{formatDate(followUp.scheduledDate)}</span>
                    <FollowUpStatusBadge status={followUp.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">AI insights</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <AiInsightsCard insights={aiInsights} />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Internal notes</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <LeadNotes leadId={lead.id} internalNotes={lead.internalNotes} />
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <LeadTimeline entries={timeline} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
