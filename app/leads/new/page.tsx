import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  await requireOnboardedBusiness();

  return (
    <>
      <PageHeader title="New Lead" description="Log a lead that reached you some other way — a phone call, in person, a referral." />
      <LeadForm />
    </>
  );
}
