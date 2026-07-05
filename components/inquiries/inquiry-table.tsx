"use client";

import { useMemo, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { InquiryRowActions } from "@/components/inquiries/inquiry-row-actions";
import { cn } from "@/lib/utils";
import { INQUIRY_STATUSES } from "@/config/constants";
import { formatDate } from "@/lib/date";
import type { Inquiry, InquiryStatus } from "@/types";

const FILTERS: Array<InquiryStatus | "All"> = ["All", ...INQUIRY_STATUSES];

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  const [filter, setFilter] = useState<InquiryStatus | "All">("New Inquiry");

  const filtered = useMemo(
    () => (filter === "All" ? inquiries : inquiries.filter((i) => i.status === filter)),
    [inquiries, filter]
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
            {inquiries.length === 0
              ? "No website inquiries yet. They'll show up here the moment your contact form submits one."
              : "No inquiries with this status."}
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
                <TableHead>Service Requested</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((inquiry) => (
                <TableRow key={inquiry.id}>
                  <TableCell className="font-medium text-foreground">{inquiry.name}</TableCell>
                  <TableCell className="text-muted-foreground">{inquiry.company || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{inquiry.email}</TableCell>
                  <TableCell className="text-muted-foreground">{inquiry.phone || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{inquiry.service || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(inquiry.submittedAt)}</TableCell>
                  <TableCell>
                    <InquiryStatusBadge status={inquiry.status} />
                  </TableCell>
                  <TableCell>
                    <InquiryRowActions inquiry={inquiry} />
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
