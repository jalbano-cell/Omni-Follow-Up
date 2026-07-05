"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { deleteEstimateAction } from "@/app/estimates/actions";

export function DeleteEstimateDialog({ estimateId, customerName }: { estimateId: string; customerName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      try {
        await deleteEstimateAction(estimateId);
        toast.success("Estimate deleted");
        router.push("/estimates");
      } catch {
        toast.error("Couldn't delete this estimate");
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="destructive" size="sm" />}>
        <Trash2 className="size-3.5" />
        Delete
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete this estimate?</DialogTitle>
          <DialogDescription>
            This permanently deletes {customerName}&apos;s estimate, along with its follow-up history and any
            replies on its thread. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
            Delete estimate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
