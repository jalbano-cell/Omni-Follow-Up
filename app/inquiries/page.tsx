import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { InquiryTable } from "@/components/inquiries/inquiry-table";
import { getInquiries } from "@/services/airtable";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InquiriesPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let inquiries;
  try {
    inquiries = await getInquiries(businessId);
  } catch (error) {
    return (
      <>
        <PageHeader title="New Website Inquiries" description="Contact form submissions from your website." />
        <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="New Website Inquiries"
        description="Contact form submissions from your website, ready for review and conversion into an estimate."
      />
      <InquiryTable inquiries={inquiries} />
    </>
  );
}
