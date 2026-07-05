import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_BADGE_VARIANT } from "@/config/constants";
import type { LeadStatus } from "@/types";

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge variant={LEAD_STATUS_BADGE_VARIANT[status]}>{status}</Badge>;
}
