import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { StatusBadge } from "@/components/estimates/status-badge";
import { StatusActions } from "@/components/estimates/status-actions";
import { FollowUpStatusBadge } from "@/components/follow-ups/follow-up-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEstimate, getFollowUpsForEstimate } from "@/services/airtable";
import { formatCurrency, formatDate, daysSince } from "@/lib/date";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { id: businessId } = await requireOnboardedBusiness();

  let estimate;
  let followUps;
  try {
    estimate = await getEstimate(businessId, id);
    followUps = estimate ? await getFollowUpsForEstimate(businessId, id) : [];
  } catch (error) {
    return <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />;
  }

  if (!estimate) notFound();

  const details: Array<[string, string]> = [
    ["Service type", estimate.serviceType],
    ["Business", estimate.businessName || "—"],
    ["Estimate value", formatCurrency(estimate.estimateValue)],
    ["Date sent", `${formatDate(estimate.dateSent)} (${daysSince(estimate.dateSent)} days ago)`],
    ["Next follow-up", estimate.nextFollowUpDate ? formatDate(estimate.nextFollowUpDate) : "—"],
    ["Last contact", estimate.lastContactDate ? formatDate(estimate.lastContactDate) : "—"],
  ];

  return (
    <>
      <Link
        href="/estimates"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to estimates
      </Link>

      <PageHeader
        title={estimate.customerName}
        description={estimate.customerEmail}
        action={<StatusBadge status={estimate.status} />}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="py-5 lg:col-span-2">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Estimate details</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
            {estimate.notes && (
              <div className="mt-5 border-t border-border pt-5">
                <dt className="text-xs text-muted-foreground">Notes</dt>
                <dd className="mt-1 text-sm text-foreground whitespace-pre-wrap">{estimate.notes}</dd>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Update status</CardTitle>
          </CardHeader>
          <CardContent className="px-5">
            <StatusActions estimateId={estimate.id} currentStatus={estimate.status} />
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 py-5">
        <CardHeader className="px-5">
          <CardTitle className="text-base">Follow-up history</CardTitle>
        </CardHeader>
        <CardContent className="px-5">
          {followUps.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No follow-ups generated yet for this estimate.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {followUps.map((followUp) => (
                <li key={followUp.id} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-medium text-muted-foreground">
                      {followUp.sentAt ? `Sent ${formatDate(followUp.sentAt)}` : formatDate(followUp.scheduledDate)}
                    </span>
                    <FollowUpStatusBadge status={followUp.status} />
                  </div>
                  <p className="mt-1 text-sm text-foreground">{followUp.message}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
