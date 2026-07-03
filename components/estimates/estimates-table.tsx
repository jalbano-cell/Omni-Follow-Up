"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/estimates/status-badge";
import { cn } from "@/lib/utils";
import { ESTIMATE_STATUSES } from "@/config/constants";
import { formatCurrency, formatDate } from "@/lib/date";
import type { Estimate, EstimateStatus } from "@/types";

const FILTERS: Array<EstimateStatus | "All"> = ["All", ...ESTIMATE_STATUSES];

export function EstimatesTable({ estimates }: { estimates: Estimate[] }) {
  const [filter, setFilter] = useState<EstimateStatus | "All">("All");

  const filtered = useMemo(
    () => (filter === "All" ? estimates : estimates.filter((e) => e.status === filter)),
    [estimates, filter]
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
            {estimates.length === 0 ? (
              <>
                No estimates yet.{" "}
                <Link href="/estimates/new" className="text-primary hover:underline">
                  Add your first one
                </Link>
                .
              </>
            ) : (
              "No estimates with this status."
            )}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((estimate) => (
                <TableRow key={estimate.id} className="cursor-pointer">
                  <TableCell className="p-0">
                    <Link
                      href={`/estimates/${estimate.id}`}
                      className="flex flex-col gap-0.5 px-4 py-3"
                    >
                      <span className="font-medium text-foreground">{estimate.customerName}</span>
                      <span className="text-xs text-muted-foreground">{estimate.customerEmail}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${estimate.id}`} className="block py-3">
                      {estimate.serviceType}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${estimate.id}`} className="block py-3 font-medium">
                      {formatCurrency(estimate.estimateValue)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${estimate.id}`} className="block py-3 text-muted-foreground">
                      {formatDate(estimate.dateSent)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/estimates/${estimate.id}`} className="block py-3">
                      <StatusBadge status={estimate.status} />
                    </Link>
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
