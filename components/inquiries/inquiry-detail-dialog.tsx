"use client";

import { Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InquiryStatusBadge } from "@/components/inquiries/inquiry-status-badge";
import { formatDate } from "@/lib/date";
import type { Inquiry } from "@/types";

export function InquiryDetailDialog({ inquiry }: { inquiry: Inquiry }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Eye className="size-3.5" />
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{inquiry.name}</DialogTitle>
          <DialogDescription>
            {inquiry.inquiryId} · Submitted {formatDate(inquiry.submittedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <InquiryStatusBadge status={inquiry.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{inquiry.email}</span>
          </div>
          {inquiry.phone && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-foreground">{inquiry.phone}</span>
            </div>
          )}
          {inquiry.company && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Company</span>
              <span className="text-foreground">{inquiry.company}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Service requested</span>
            <span className="text-foreground">{inquiry.service || "Not specified"}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">Message</span>
            <p className="rounded-lg border border-border bg-muted/40 p-3 whitespace-pre-wrap text-foreground/90">
              {inquiry.message}
            </p>
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
