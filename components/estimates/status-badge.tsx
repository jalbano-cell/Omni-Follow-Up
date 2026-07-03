import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_VARIANT } from "@/config/constants";
import type { EstimateStatus } from "@/types";

export function StatusBadge({ status }: { status: EstimateStatus }) {
  return <Badge variant={STATUS_BADGE_VARIANT[status]}>{status}</Badge>;
}
