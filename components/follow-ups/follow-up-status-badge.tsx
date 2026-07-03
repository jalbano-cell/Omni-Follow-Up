import { Badge } from "@/components/ui/badge";
import { FOLLOWUP_STATUS_BADGE_VARIANT, FOLLOWUP_STATUS_LABEL } from "@/config/constants";
import type { FollowUpStatus } from "@/types";

export function FollowUpStatusBadge({ status }: { status: FollowUpStatus }) {
  return <Badge variant={FOLLOWUP_STATUS_BADGE_VARIANT[status]}>{FOLLOWUP_STATUS_LABEL[status]}</Badge>;
}
