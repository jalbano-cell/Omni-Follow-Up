import { PageHeader } from "@/components/layout/page-header";
import { EstimateForm, type EstimateFormPrefill } from "@/components/estimates/estimate-form";
import { getInquiry } from "@/services/airtable";
import { SERVICE_TYPES } from "@/config/constants";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

function matchServiceType(raw: string): string {
  const found = SERVICE_TYPES.find((type) => type.toLowerCase() === raw.trim().toLowerCase());
  return found ?? SERVICE_TYPES[0];
}

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ fromInquiry?: string }>;
}) {
  const { id: businessId } = await requireOnboardedBusiness();
  const { fromInquiry } = await searchParams;

  let prefill: EstimateFormPrefill | undefined;
  if (fromInquiry) {
    const inquiry = await getInquiry(businessId, fromInquiry);
    if (inquiry && inquiry.status === "New Inquiry") {
      const matchedService = inquiry.service ? matchServiceType(inquiry.service) : SERVICE_TYPES[0];
      const notes = [
        inquiry.phone && `Phone: ${inquiry.phone}`,
        inquiry.service && inquiry.service.toLowerCase() !== matchedService.toLowerCase() &&
          `Requested service (as submitted): ${inquiry.service}`,
        inquiry.message && `Inquiry message:\n${inquiry.message}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n");

      prefill = {
        inquiryId: inquiry.id,
        customerName: inquiry.name,
        customerEmail: inquiry.email,
        serviceType: matchedService,
        notes,
      };
    }
  }

  return (
    <>
      <PageHeader
        title="New Estimate"
        description={
          prefill ? "Prefilled from a website inquiry — add the estimate value and date sent." : "Log an estimate you've sent to a customer."
        }
      />
      <EstimateForm prefill={prefill} />
    </>
  );
}
