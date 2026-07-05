"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { importLeadsCsvAction } from "@/app/leads/actions";

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function ImportCsvDialog() {
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function importFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      toast.error("Choose a CSV file first");
      return;
    }

    startTransition(async () => {
      try {
        const text = await readFileAsText(file);
        const result = await importLeadsCsvAction(text);
        if (result.imported === 0) {
          toast.error("No valid rows found — check the file has name/email columns");
        } else {
          toast.success(`Imported ${result.imported} lead${result.imported === 1 ? "" : "s"}${result.skipped > 0 ? ` (${result.skipped} skipped)` : ""}`);
        }
      } catch {
        toast.error("Couldn't import that file");
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <Upload className="size-3.5" />
        Import CSV
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Import leads from CSV</DialogTitle>
          <DialogDescription>
            Columns: <code className="text-xs">name</code>, <code className="text-xs">email</code>,{" "}
            <code className="text-xs">phone</code>, <code className="text-xs">company</code>,{" "}
            <code className="text-xs">service</code>, <code className="text-xs">message</code> — header row required,
            column order doesn&apos;t matter.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="csv-file" className="text-xs">
            CSV file
          </Label>
          <input
            id="csv-file"
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-2.5 file:py-1 file:text-xs file:font-medium"
          />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={importFile} disabled={isPending}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
