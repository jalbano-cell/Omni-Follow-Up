"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Copy, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { rotateIntakeApiKeyAction } from "@/app/settings/actions";

const SNIPPET = `fetch("ENDPOINT_URL", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer API_KEY",
  },
  body: JSON.stringify({ name, email, phone, company, service, message }),
});`;

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

export function IntakeKeyCard({ apiKey, endpointUrl }: { apiKey: string | null; endpointUrl: string }) {
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();

  function rotate() {
    startTransition(async () => {
      await rotateIntakeApiKeyAction();
      toast.success(apiKey ? "Key regenerated — update your website's contact form with the new key." : "Key generated.");
    });
  }

  const snippet = SNIPPET.replace("ENDPOINT_URL", endpointUrl).replace("API_KEY", apiKey ?? "API_KEY");

  return (
    <Card className="py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Website intake API</CardTitle>
        <CardDescription>
          Point your website&apos;s contact form at this endpoint — every submission appears on{" "}
          <span className="font-medium text-foreground">Leads</span> within seconds.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-endpoint" className="text-xs">
            Endpoint
          </Label>
          <div className="flex gap-2">
            <Input id="intake-endpoint" readOnly value={endpointUrl} className="font-mono text-xs" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy endpoint URL"
              onClick={() => copyToClipboard(endpointUrl, "Endpoint URL")}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="intake-key" className="text-xs">
            API key
          </Label>
          <div className="flex gap-2">
            <Input
              id="intake-key"
              readOnly
              type={revealed ? "text" : "password"}
              value={apiKey ?? "Not generated yet"}
              className="font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={revealed ? "Hide key" : "Show key"}
              onClick={() => setRevealed((v) => !v)}
              disabled={!apiKey}
            >
              {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copy API key"
              onClick={() => apiKey && copyToClipboard(apiKey, "API key")}
              disabled={!apiKey}
            >
              <Copy className="size-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Treat this like a password — anyone with it can submit inquiries as your business. Regenerating
            invalidates the old key immediately.
          </p>
        </div>

        <Button type="button" variant="outline" size="sm" className="self-start" onClick={rotate} disabled={isPending}>
          <RefreshCw className="size-3.5" />
          {apiKey ? "Regenerate key" : "Generate key"}
        </Button>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Example request</Label>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground/90">
            <code>{snippet}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
