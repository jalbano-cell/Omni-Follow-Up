import { PageHeader } from "@/components/layout/page-header";
import { DatabaseErrorState } from "@/components/layout/database-error-state";
import { ReplyList } from "@/components/replies/reply-list";
import { SyncRepliesButton } from "@/components/replies/sync-replies-button";
import { getReplyInbox } from "@/services/replyMatcher";
import { requireOnboardedBusiness } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RepliesPage() {
  const { id: businessId } = await requireOnboardedBusiness();

  let items;
  try {
    items = await getReplyInbox(businessId);
  } catch (error) {
    return (
      <>
        <PageHeader title="Reply Inbox" description="Customer replies to your follow-ups." />
        <DatabaseErrorState message={error instanceof Error ? error.message : "Unknown error"} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Reply Inbox"
        description="Customer replies to your follow-ups, matched by email thread."
        action={<SyncRepliesButton />}
      />
      <ReplyList items={items} />
    </>
  );
}
