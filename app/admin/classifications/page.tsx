import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClassifyNowButton } from "@/components/admin/classify-now-button";
import { getAllLeadClassifications } from "@/services/leadClassification";
import { getAllBusinesses } from "@/services/business";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Step-1 review list for the inbound-email lead classifier
 * (services/leadClassification.ts) — every decision Claude Haiku has made
 * on a scanned Gmail thread, newest first, so the prompt can be eyeballed
 * for accuracy and calibrated before anything downstream (drafting, sending)
 * ever depends on it. Agency-only (requireAdmin), same gate as the rest of
 * /admin — this spans every business's classifications, not just one.
 */
export default async function LeadClassificationsPage() {
  await requireAdmin();

  const [classifications, businesses] = await Promise.all([getAllLeadClassifications(), getAllBusinesses()]);
  const businessNameById = new Map(businesses.map((b) => [b.id, b.businessName]));

  return (
    <>
      <PageHeader
        title="Lead classifications"
        description="Every classifier decision on a scanned Gmail thread — review for accuracy before anything downstream depends on it."
        action={<ClassifyNowButton />}
      />

      {classifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No classifications yet. They&apos;ll show up here once the daily cron scans a connected Gmail inbox, or
            click &quot;Classify now&quot; to run it immediately.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>From</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead>Intent</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Classified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classifications.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[140px] truncate" title={businessNameById.get(c.workspaceId) ?? c.workspaceId}>
                      {businessNameById.get(c.workspaceId) ?? c.workspaceId}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[180px] truncate" title={c.fromHeader ?? undefined}>
                      {c.fromHeader ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[220px] truncate" title={c.subject ?? undefined}>
                      {c.subject ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    {c.status !== "classified" ? (
                      <Badge variant="secondary">Unclassified</Badge>
                    ) : c.isLead ? (
                      <Badge variant="success">
                        Lead{c.confidence !== null ? ` · ${Math.round(c.confidence * 100)}%` : ""}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        Not a lead{c.confidence !== null ? ` · ${Math.round(c.confidence * 100)}%` : ""}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.intent ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[260px] truncate" title={c.reason ?? c.rawResponse ?? undefined}>
                      {c.reason ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
