"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { cn } from "@/lib/utils";
import { LEAD_STATUSES } from "@/config/constants";
import { formatDate } from "@/lib/date";
import type { Lead, LeadStatus } from "@/types";

const FILTERS: Array<LeadStatus | "All"> = ["All", ...LEAD_STATUSES];

export function LeadTable({ leads }: { leads: Lead[] }) {
  const [filter, setFilter] = useState<LeadStatus | "All">("New Inquiry");

  const filtered = useMemo(
    () => (filter === "All" ? leads : leads.filter((l) => l.status === filter)),
    [leads, filter]
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === status
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
            )}
          >
            {status}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {leads.length === 0
              ? "No leads yet. They'll show up here the moment your contact form submits one."
              : "No leads with this status."}
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
                    <LeadRowActions lead={lead} />
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
