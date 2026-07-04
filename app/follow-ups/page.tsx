import { PageHeader } from "@/components/layout/page-header";
import { AirtableErrorState } from "@/components/layout/airtable-error-state";
import { FollowUpQueue } from "@/components/follow-ups/follow-up-queue";
import { GenerateFollowUpsButton } from "@/components/follow-ups/generate-follow-ups-button";
import { getFollowUpQueue } from "@/services/followupEngine";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let queue;
  try {
    queue = await getFollowUpQueue(businessId);
  } catch (error) {
    return (
      <>
        <PageHeader title="Follow-up Queue" description="Suggested follow-ups waiting on your review." />
        <AirtableErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Follow-up Queue"
        description="Suggested follow-ups waiting on your review."
        action={<GenerateFollowUpsButton />}
      />
      <FollowUpQueue items={queue} />
    </>
  );
}
