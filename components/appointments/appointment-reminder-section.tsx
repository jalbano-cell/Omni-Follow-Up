"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Pencil, X, Send, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveReminderAction,
  editReminderMessageAction,
  skipReminderAction,
  sendReminderAction,
} from "@/app/appointments/actions";
import type { Appointment } from "@/types";

/**
 * The pre-appointment reminder's own Approve/Edit/Skip/Send lifecycle —
 * mirrors components/follow-ups/follow-up-card.tsx's button layout, scoped
 * to one Appointment's reminder instead of the Estimate Follow-up Queue.
 * Renders nothing until services/appointmentLifecycle.ts's
 * runAppointmentReminderDraftJob has drafted one (reminderStatus is null
 * until then).
 */
export function AppointmentReminderSection({ appointment }: { appointment: Appointment }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState(appointment.reminderMessage ?? "");

  if (!appointment.reminderStatus) return null;

  function approve() {
    startTransition(async () => {
      const result = await approveReminderAction(appointment.id);
      if (result.ok) toast.success("Reminder approved — ready to send");
      else toast.error(result.error);
    });
  }

  function saveEdit() {
    startTransition(async () => {
      const result = await editReminderMessageAction(appointment.id, message);
      if (result.ok) {
        setIsEditing(false);
        toast.success("Reminder updated");
      } else {
        toast.error(result.error);
      }
    });
  }

  function skip() {
    startTransition(async () => {
      const result = await skipReminderAction(appointment.id);
      if (result.ok) toast("Reminder skipped");
      else toast.error(result.error);
    });
  }

  function send() {
    startTransition(async () => {
      const result = await sendReminderAction(appointment.id);
      if (result.ok) toast.success("Reminder sent");
      else toast.error(`Send failed: ${result.error}`);
    });
  }

  if (appointment.reminderStatus === "skipped") {
    return <p className="mt-4 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Reminder skipped.</p>;
  }

  if (appointment.reminderStatus === "sent") {
    return (
      <p className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground">
        Reminder sent.
      </p>
    );
  }

  const isApproved = appointment.reminderStatus === "approved";
  const isFailed = appointment.reminderStatus === "failed";

  return (
    <div className="mt-4 rounded-lg border border-border px-3 py-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {isFailed ? "Reminder failed to send" : isApproved ? "Reminder approved" : "Reminder drafted"}
      </p>
      {isEditing ? (
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} autoFocus />
      ) : (
        <p className="text-sm whitespace-pre-wrap text-foreground/90">{appointment.reminderMessage}</p>
      )}
      <div className="mt-3 flex gap-2">
        {isEditing ? (
          <>
            <Button size="sm" onClick={saveEdit} disabled={isPending}>
              <Check className="size-3.5" />
              Save
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setMessage(appointment.reminderMessage ?? "");
                setIsEditing(false);
              }}
              disabled={isPending}
            >
              Cancel
            </Button>
          </>
        ) : isApproved || isFailed ? (
          <>
            <Button size="sm" onClick={send} disabled={isPending}>
              {isFailed ? <RotateCw className="size-3.5" /> : <Send className="size-3.5" />}
              {isFailed ? "Retry Send" : "Send Reminder"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isPending}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={skip} disabled={isPending}>
              <X className="size-3.5" />
              Skip
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={approve} disabled={isPending}>
              <Check className="size-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} disabled={isPending}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={skip} disabled={isPending}>
              <X className="size-3.5" />
              Skip
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
