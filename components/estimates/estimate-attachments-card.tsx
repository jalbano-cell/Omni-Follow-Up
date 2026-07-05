"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { uploadEstimateAttachmentAction, deleteEstimateAttachmentAction } from "@/app/estimates/actions";
import type { EstimateAttachment } from "@/types";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EstimateAttachmentsCard({
  estimateId,
  attachments,
}: {
  estimateId: string;
  attachments: EstimateAttachment[];
}) {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a file first");
      return;
    }
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        await uploadEstimateAttachmentAction(estimateId, formData);
        if (fileInputRef.current) fileInputRef.current.value = "";
        toast.success("Attachment uploaded");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Upload failed");
      }
    });
  }

  function remove(attachmentId: string) {
    startTransition(async () => {
      await deleteEstimateAttachmentAction(estimateId, attachmentId);
      toast.success("Attachment removed");
    });
  }

  return (
    <Card className="mt-6 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Attachments</CardTitle>
        <CardDescription>Visible to the customer on their estimate link (10MB max per file).</CardDescription>
      </CardHeader>
      <CardContent className="px-5">
        {attachments.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No attachments yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col divide-y divide-border">
            {attachments.map((attachment) => (
              <li key={attachment.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm text-foreground">{attachment.fileName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatSize(attachment.sizeBytes)}</span>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remove attachment"
                  onClick={() => remove(attachment.id)}
                  disabled={isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium"
          />
          <Button size="sm" onClick={upload} disabled={isPending}>
            <Upload className="size-3.5" />
            Upload
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
