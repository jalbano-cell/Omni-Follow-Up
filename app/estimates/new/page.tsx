import { PageHeader } from "@/components/layout/page-header";
import { EstimateForm } from "@/components/estimates/estimate-form";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage() {
  await requireOnboardedBusiness();

  return (
    <>
      <PageHeader title="New Estimate" description="Log an estimate you've sent to a customer." />
      <EstimateForm />
    </>
  );
}
