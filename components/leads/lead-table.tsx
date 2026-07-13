"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES, LEAD_SOURCES, type LeadSource } from "@/config/constants";
import { formatDate } from "@/lib/date";
import type { Lead, LeadStatus } from "@/types";

const STATUS_FILTERS: Array<LeadStatus | "All"> = ["All", ...LEAD_STATUSES];
const SOURCE_FILTERS: Array<LeadSource | "All"> = ["All", ...LEAD_SOURCES];

export function LeadTable({ leads, estimatesEnabled = true }: { leads: Lead[]; estimatesEnabled?: boolean }) {
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "All">("New Inquiry");
  const [sourceFilter, setSourceFilter] = useState<LeadSource | "All">("All");

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          (statusFilter === "All" || l.status === statusFilter) &&
          (sourceFilter === "All" || l.leadSource === sourceFilter)
      ),
    [leads, statusFilter, sourceFilter]
  );

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(status)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              statusFilter === status
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {status}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {SOURCE_FILTERS.map((source) => (
          <button
            key={source}
            type="button"
            onClick={() => setSourceFilter(source)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              sourceFilter === source
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {source}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {leads.length === 0
              ? "No leads yet. They'll show up here the moment your contact form submits one."
              : "No leads match these filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Requested Service</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium text-foreground">
                    <Link href={`/leads/${lead.id}`} className="hover:underline">
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[140px] truncate" title={lead.company || undefined}>
                      {lead.company || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.email}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <span className="block max-w-[180px] truncate" title={lead.requestedService || undefined}>
                      {lead.requestedService || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col gap-1">
                      <span>{formatDate(lead.createdTime)}</span>
                      <Badge variant="outline" className="w-fit text-[10px]">
                        {lead.leadSource}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{lead.assignedTo || "—"}</TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell>
                    <LeadRowActions lead={lead} estimatesEnabled={estimatesEnabled} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
