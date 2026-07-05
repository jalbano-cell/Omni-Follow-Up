import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { LeadTable } from "@/components/leads/lead-table";
import { getLeads } from "@/services/db";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { id: businessId } = await requireOnboardedBusiness();

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
      />
      <LeadTable leads={leads} />
    </>
  );
}
