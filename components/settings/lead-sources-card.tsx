"use client";

import { toast } from "sonner";
import { CheckCircle2, XCircle, Copy } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

interface LeadSourceRow {
  label: string;
  active: boolean;
  detail: string;
}

export function LeadSourcesCard({
  intakeApiKeyPresent,
  webhookEndpointUrl,
  gmailConnected,
  monitorGmailInbox,
}: {
  intakeApiKeyPresent: boolean;
  webhookEndpointUrl: string;
  gmailConnected: boolean;
  monitorGmailInbox: boolean;
}) {
  const rows: LeadSourceRow[] = [
    {
      label: "Website Form",
      active: intakeApiKeyPresent,
      detail: intakeApiKeyPresent ? "Active — see Website intake API below" : "Generate an API key below to activate",
    },
    {
      label: "Gmail",
      active: gmailConnected && monitorGmailInbox,
      detail: !gmailConnected ? "Connect Google above to activate" : monitorGmailInbox ? "Primary source — monitoring enabled" : "Monitoring disabled — enable under Google connection",
    },
    { label: "Manual Entry", active: true, detail: "Always available — Leads → New Lead" },
    { label: "CSV Import", active: true, detail: "Always available — Leads → Import CSV" },
    {
      label: "Webhook",
      active: intakeApiKeyPresent,
      detail: intakeApiKeyPresent ? "Active — authenticates with the same API key" : "Generate an API key below to activate",
    },
  ];

  return (
    <>
      <CardHeader className="px-0">
        <CardTitle className="text-base">Lead sources</CardTitle>
        <CardDescription>
          Gmail is your primary source. These are optional, advanced ways a lead can also enter Omni Follow Up — all
          funnel into the same pipeline.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.label} className="flex items-center gap-2.5 rounded-lg border border-border px-4 py-2.5">
              {row.active ? (
                <CheckCircle2 className="size-4 shrink-0 text-success" />
              ) : (
                <XCircle className="size-4 shrink-0 text-muted-foreground" />
              )}
              <span className="text-sm font-medium text-foreground">{row.label}</span>
              <span className="ml-auto text-right text-xs text-muted-foreground">{row.detail}</span>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="webhook-endpoint" className="text-xs">
            Webhook endpoint
          </Label>
          <div className="flex gap-2">
            <Input id="webhook-endpoint" readOnly value={webhookEndpointUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy webhook endpoint"
              onClick={() => copyToClipboard(webhookEndpointUrl, "Webhook endpoint")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Same bearer-token API key as the Website intake API below — accepts the same JSON payload.
          </p>
        </div>
      </CardContent>
    </>
  );
}
