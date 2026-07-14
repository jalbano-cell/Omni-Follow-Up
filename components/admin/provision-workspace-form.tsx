"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/estimates/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { provisionNewWorkspaceAction, sendOnboardingWelcomeEmailAction } from "@/app/admin/actions";
import { PRODUCT_MODE_LABELS, PRODUCT_MODE_OPTIONS } from "@/config/constants";

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

interface Provisioned {
  claimUrl: string;
  subject: string;
  body: string;
  ownerName: string;
  ownerEmail: string;
  businessName: string;
  canSendEmail: boolean;
}

export function ProvisionWorkspaceForm() {
  const [, startTransition] = useTransition();
  const [isSending, startSendTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<Provisioned | null>(null);
  const [sent, setSent] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await provisionNewWorkspaceAction(formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSent(false);
      setResult({
        claimUrl: res.claimUrl!,
        subject: res.emailSubject!,
        body: res.emailBody!,
        ownerName: res.ownerName!,
        ownerEmail: res.ownerEmail!,
        businessName: res.businessName!,
        canSendEmail: res.canSendEmail ?? false,
      });
      toast.success("Workspace created — copy the link/email below or send it directly.");
      formRef.current?.reset();
    });
  }

  function sendEmail() {
    if (!result) return;
    startSendTransition(async () => {
      const formData = new FormData();
      formData.set("businessName", result.businessName);
      formData.set("ownerName", result.ownerName);
      formData.set("ownerEmail", result.ownerEmail);
      formData.set("claimUrl", result.claimUrl);

      const res = await sendOnboardingWelcomeEmailAction(formData);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setSent(true);
      toast.success(`Sent to ${result.ownerEmail}`);
    });
  }

  return (
    <Card className="py-6">
      <CardContent className="flex flex-col gap-4 px-6">
        <form ref={formRef} action={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="businessName">Business name</Label>
            <Input id="businessName" name="businessName" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerName">Owner name</Label>
            <Input id="ownerName" name="ownerName" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ownerEmail">Owner email</Label>
            <Input id="ownerEmail" name="ownerEmail" type="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productMode">Product mode</Label>
            <Select name="productMode" defaultValue="both" required>
              <SelectTrigger id="productMode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_MODE_OPTIONS.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {PRODUCT_MODE_LABELS[mode]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SubmitButton>Create workspace</SubmitButton>
        </form>

        {result && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label className="text-xs">Claim link — send this to the client</Label>
            <div className="flex gap-2">
              <Input readOnly value={result.claimUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy claim link"
                onClick={() => copyToClipboard(result.claimUrl, "Claim link")}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Onboarding email</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(`Subject: ${result.subject}\n\n${result.body}`, "Email")}
                >
                  <Copy className="size-3.5" />
                  Copy email
                </Button>
                {result.canSendEmail && (
                  <Button type="button" size="sm" disabled={isSending || sent} onClick={sendEmail}>
                    <Send className="size-3.5" />
                    {sent ? "Sent" : isSending ? "Sending…" : "Send email"}
                  </Button>
                )}
              </div>
            </div>
            {!result.canSendEmail && (
              <p className="text-xs text-muted-foreground">
                Connect your own Gmail in Settings to send this directly from here — for now, copy it above.
              </p>
            )}
            <Input readOnly value={result.subject} className="text-xs font-medium" aria-label="Email subject" />
            <Textarea readOnly value={result.body} rows={12} className="text-xs" aria-label="Email body" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
