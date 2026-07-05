import { PageHeader } from "@/components/layout/page-header";
import { EstimateForm, type EstimateFormPrefill } from "@/components/estimates/estimate-form";
import { getLead } from "@/services/db";
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
  searchParams: Promise<{ fromLead?: string }>;
}) {
  const { id: businessId } = await requireOnboardedBusiness();
  const { fromLead } = await searchParams;

  let prefill: EstimateFormPrefill | undefined;
  if (fromLead) {
    const lead = await getLead(businessId, fromLead);
    if (lead && lead.status === "New Inquiry") {
      const matchedService = lead.requestedService ? matchServiceType(lead.requestedService) : SERVICE_TYPES[0];
      const notes = [
        lead.phone && `Phone: ${lead.phone}`,
        lead.requestedService && lead.requestedService.toLowerCase() !== matchedService.toLowerCase() &&
          `Requested service (as submitted): ${lead.requestedService}`,
        lead.message && `Lead message:\n${lead.message}`,
      ]
        .filter((line): line is string => Boolean(line))
        .join("\n\n");

      prefill = {
        leadId: lead.id,
        customerName: lead.name,
        customerEmail: lead.email,
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
          prefill ? "Prefilled from a lead — add the estimate value and date sent." : "Log an estimate you've sent to a customer."
        }
      />
      <EstimateForm prefill={prefill} />
    </>
  );
}
