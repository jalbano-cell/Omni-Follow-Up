"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowRightCircle, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InquiryDetailDialog } from "@/components/inquiries/inquiry-detail-dialog";
import { archiveInquiryAction } from "@/app/inquiries/actions";
import type { Inquiry } from "@/types";

export function InquiryRowActions({ inquiry }: { inquiry: Inquiry }) {
  const [isPending, startTransition] = useTransition();

  function archive() {
    startTransition(async () => {
      await archiveInquiryAction(inquiry.id);
      toast.success("Inquiry archived");
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      <InquiryDetailDialog inquiry={inquiry} />
      {inquiry.status === "New Inquiry" && (
        <>
          <Button variant="outline" size="sm" render={<Link href={`/estimates/new?fromInquiry=${inquiry.id}`} />}>
            <ArrowRightCircle className="size-3.5" />
            Convert to Estimate
          </Button>
          <Button variant="ghost" size="sm" onClick={archive} disabled={isPending}>
            <Archive className="size-3.5" />
            Archive
          </Button>
        </>
      )}
    </div>
  );
}
