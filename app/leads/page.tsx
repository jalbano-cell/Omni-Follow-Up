import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { LeadTable } from "@/components/leads/lead-table";
import { ImportCsvDialog } from "@/components/leads/import-csv-dialog";
import { Button } from "@/components/ui/button";
import { getLeads } from "@/services/db";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const business = await requireOnboardedBusiness();
  const businessId = business.id;

  let leads;
  try {
    leads = await getLeads(businessId);
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
      <LeadTable leads={leads} estimatesEnabled={business.productMode !== "appointments_only"} />
    </>
  );
}
