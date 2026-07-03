import { PageHeader } from "@/components/layout/page-header";
import { EstimateForm } from "@/components/estimates/estimate-form";

export default function NewEstimatePage() {
  return (
    <>
      <PageHeader title="New Estimate" description="Log an estimate you've sent to a customer." />
      <EstimateForm />
    </>
  );
}
