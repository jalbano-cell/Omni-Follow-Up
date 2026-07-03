import { DatabaseZap } from "lucide-react";

export function AirtableErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-20 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-warning/10 text-warning">
        <DatabaseZap className="size-5" strokeWidth={2} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">Airtable isn&apos;t connected yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        Add <code className="rounded bg-muted px-1 py-0.5 text-xs">AIRTABLE_API_KEY</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">AIRTABLE_BASE_ID</code> to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> (see{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.example</code>) and restart the
        dev server.
      </p>
      <p className="mt-3 max-w-sm text-xs text-muted-foreground/70">{message}</p>
    </div>
  );
}
