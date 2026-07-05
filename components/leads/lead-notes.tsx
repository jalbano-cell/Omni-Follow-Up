"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/estimates/submit-button";
import { addInternalNoteAction } from "@/app/leads/actions";

/** internalNotes is a single field storing newest-first entries separated by a blank line, each prefixed "[timestamp] ...". */
function parseNotes(internalNotes: string): string[] {
  return internalNotes
    .split("\n\n")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function LeadNotes({ leadId, internalNotes }: { leadId: string; internalNotes: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const notes = parseNotes(internalNotes);

  function handleSubmit(formData: FormData) {
    const note = String(formData.get("note") ?? "");
    if (!note.trim()) return;
    startTransition(async () => {
      await addInternalNoteAction(leadId, note);
      formRef.current?.reset();
      toast.success("Note added");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
        <Textarea
          name="note"
          placeholder="Add an internal note — only your business sees this."
          rows={2}
          disabled={isPending}
        />
        <div className="flex justify-end">
          <SubmitButton size="sm">Add note</SubmitButton>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No internal notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-3 border-t border-border pt-4">
          {notes.map((note, i) => (
            <li key={i} className="text-sm whitespace-pre-wrap text-foreground/90">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
