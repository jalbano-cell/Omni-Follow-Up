import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { Button } from "@/components/ui/button";
import { EstimatesTable } from "@/components/estimates/estimates-table";
import { getEstimates } from "@/services/airtable";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let estimates;
  try {
    estimates = await getEstimates(businessId);
  } catch (error) {
    return (
      <>
        <PageHeader title="Estimates" description="Every estimate you've sent, in one place." />
        <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Estimates"
        description="Every estimate you've sent, in one place."
        action={
          <Button render={<Link href="/estimates/new" />}>
            <Plus className="size-4" />
            New Estimate
          </Button>
        }
      />
      <EstimatesTable estimates={estimates} />
    </>
  );
}
