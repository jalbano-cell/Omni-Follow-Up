import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { LeadTable } from "@/components/leads/lead-table";
import { ImportCsvDialog } from "@/components/leads/import-csv-dialog";
import { Button } from "@/components/ui/button";
import { getLeads, getAppointments } from "@/services/db";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const business = await requireOnboardedBusiness();
  const businessId = business.id;
  const appointmentsEnabled = business.productMode !== "estimates_only";

  let leads;
  const pendingAppointmentsByLeadId: Record<string, string> = {};
  try {
    leads = await getLeads(businessId);
    if (appointmentsEnabled) {
      const appointments = await getAppointments(businessId);
      for (const appointment of appointments) {
        if (appointment.status === "requested" && appointment.leadId) {
          pendingAppointmentsByLeadId[appointment.leadId] = appointment.id;
        }
      }
    }
  } catch (error) {
    return (
      <>
        <PageHeader title="Leads" description="Every inbound business inquiry, in one place." />
        <DatabaseErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every inbound business inquiry, in one place — ready for review and conversion into an estimate."
        action={
          <div className="flex gap-2">
            <ImportCsvDialog />
            <Button render={<Link href="/leads/new" />}>
              <Plus className="size-3.5" />
              New Lead
            </Button>
          </div>
        }
      />
      <LeadTable
        leads={leads}
        estimatesEnabled={business.productMode !== "appointments_only"}
        pendingAppointmentsByLeadId={pendingAppointmentsByLeadId}
      />
    </>
  );
}
