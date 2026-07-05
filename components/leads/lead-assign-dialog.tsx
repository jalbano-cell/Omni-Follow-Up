"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assignLeadAction } from "@/app/leads/actions";

export function LeadAssignDialog({ leadId, currentAssignee }: { leadId: string; currentAssignee: string }) {
  const [value, setValue] = useState(currentAssignee);
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      await assignLeadAction(leadId, value);
      toast.success(value.trim() ? `Assigned to ${value.trim()}` : "Unassigned");
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserPlus className="size-3.5" />
        Assign
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Assign lead</DialogTitle>
          <DialogDescription>
            No team roster yet — enter whoever&apos;s handling this lead as free text.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="assignedTo">Assigned to</Label>
          <Input
            id="assignedTo"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. Jordan"
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <DialogClose render={<Button onClick={save} disabled={isPending} />}>Save</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
