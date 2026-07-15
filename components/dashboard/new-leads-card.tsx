"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageSquarePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { LeadRowActions } from "@/components/leads/lead-row-actions";
import { formatDate } from "@/lib/date";
import type { Lead } from "@/types";

/**
 * The Dashboard's "New Leads" card — pulled out of app/page.tsx (a Server
 * Component) into its own client component so archiving can update this
 * card's own rendering the instant the server confirms it, same fix as
 * lead-table.tsx. Without this, the row only disappears once the Dashboard's
 * own Server Component re-fetches (revalidatePath's round-trip), which read
 * as "the button doesn't work" and invited repeat clicks on other rows.
 */
export function NewLeadsCard({
  leads: leadsProp,
  estimatesEnabled,
  pendingAppointmentsByLeadId = {},
}: {
  leads: Lead[];
  estimatesEnabled: boolean;
  /** Maps leadId -> its still-`requested` Appointment id, if any — see lead-row-actions.tsx's pendingAppointmentId. */
  pendingAppointmentsByLeadId?: Record<string, string>;
}) {
  const [leads, setLeads] = useState(leadsProp);
  useEffect(() => setLeads(leadsProp), [leadsProp]);

  const [pendingAppointments, setPendingAppointments] = useState(pendingAppointmentsByLeadId);
  useEffect(() => setPendingAppointments(pendingAppointmentsByLeadId), [pendingAppointmentsByLeadId]);

  const visible = leads.filter((l) => l.status === "New Inquiry").slice(0, 5);

  return (
    <Card className="py-5">
      <CardHeader className="flex flex-row items-center justify-between px-5">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquarePlus className="size-4 text-muted-foreground" />
          New Leads
        </CardTitle>
        <Button variant="ghost" size="sm" render={<Link href="/leads" />}>
          View all <ArrowRight className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="px-5">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No new leads. Once your website&apos;s contact form submits one, it&apos;ll show up here within seconds.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((lead) => (
              <li key={lead.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Link href={`/leads/${lead.id}`} className="min-w-0 hover:opacity-80">
                  <p className="truncate text-sm font-medium text-foreground">
                    {lead.name}
                    {lead.company && <span className="font-normal text-muted-foreground"> · {lead.company}</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {lead.requestedService || "General inquiry"} · {formatDate(lead.createdTime)}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  <LeadStatusBadge status={lead.status} />
                  <LeadRowActions
                    lead={lead}
                    estimatesEnabled={estimatesEnabled}
                    pendingAppointmentId={pendingAppointments[lead.id]}
                    onArchived={() =>
                      setLeads((prev) => prev.map((l) => (l.id === lead.id ? { ...l, status: "Archived" } : l)))
                    }
                    onAppointmentApproved={() =>
                      setPendingAppointments((prev) => {
                        const next = { ...prev };
                        delete next[lead.id];
                        return next;
                      })
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
