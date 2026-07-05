"use client";

import { useRef, useState, useTransition } from "react";
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
import { importLeadsCsvAction, type CsvImportSummary } from "@/app/leads/actions";

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
  const [summary, setSummary] = useState<CsvImportSummary | null>(null);
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
        setSummary(result);
        if (result.imported === 0) {
          toast.error("No valid rows found — check the file has name/email columns");
        } else {
          toast.success(`Imported ${result.imported} lead${result.imported === 1 ? "" : "s"}`);
        }
      } catch {
        toast.error("Couldn't import that file");
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setSummary(null);
      }}
    >
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
        {summary && (
          <div className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 text-xs">
            <div className="flex gap-4 font-medium text-foreground">
              <span>Imported {summary.imported}</span>
              <span>Skipped {summary.skippedRows.length}</span>
              <span>Errors {summary.errors.length}</span>
            </div>
            {(summary.skippedRows.length > 0 || summary.errors.length > 0) && (
              <ul className="max-h-32 list-disc overflow-y-auto pl-4 text-muted-foreground">
                {[...summary.skippedRows, ...summary.errors].map((message, i) => (
                  <li key={i}>{message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
          <Button onClick={importFile} disabled={isPending}>
            {isPending ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
