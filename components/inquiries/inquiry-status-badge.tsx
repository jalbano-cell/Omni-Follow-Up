import { Badge } from "@/components/ui/badge";
import { INQUIRY_STATUS_BADGE_VARIANT } from "@/config/constants";
import type { InquiryStatus } from "@/types";

export function InquiryStatusBadge({ status }: { status: InquiryStatus }) {
  return <Badge variant={INQUIRY_STATUS_BADGE_VARIANT[status]}>{status}</Badge>;
}
