import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { FollowUpQueue } from "@/components/follow-ups/follow-up-queue";
import { GenerateFollowUpsButton } from "@/components/follow-ups/generate-follow-ups-button";
import { getFollowUpQueue } from "@/services/followupEngine";
import { requireEstimatesEnabled } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FollowUpsPage() {
  const { id: businessId } = await requireEstimatesEnabled();

  let queue;
  try {
    queue = await getFollowUpQueue(businessId);
  } catch (error) {
    return (
      <>
        <PageHeader title="Follow-up Queue" description="Suggested follow-ups waiting on your review." />
        <DatabaseErrorState message={error instanceof Error ? error.message : "Unknown error"} />
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
