"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/estimates/submit-button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { provisionNewWorkspaceAction } from "@/app/admin/actions";
import { PLAN_LABELS } from "@/config/constants";
import type { WorkspacePlan } from "@/types";

const PLAN_OPTIONS: WorkspacePlan[] = ["grow", "transform"];

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

export function ProvisionWorkspaceForm() {
  const [, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<{ subject: string; body: string } | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await provisionNewWorkspaceAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setClaimUrl(result.claimUrl ?? null);
      setEmail(result.emailSubject && result.emailBody ? { subject: result.emailSubject, body: result.emailBody } : null);
      toast.success("Workspace created — copy the link or email below and send it to the client.");
      formRef.current?.reset();
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
            <Label htmlFor="plan">Plan</Label>
            <Select name="plan" defaultValue="grow" required>
              <SelectTrigger id="plan" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((plan) => (
                  <SelectItem key={plan} value={plan}>
                    {PLAN_LABELS[plan]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SubmitButton>Create workspace</SubmitButton>
        </form>

        {claimUrl && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label className="text-xs">Claim link — send this to the client</Label>
            <div className="flex gap-2">
              <Input readOnly value={claimUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copy claim link"
                onClick={() => copyToClipboard(claimUrl, "Claim link")}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        )}

        {email && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Onboarding email — copy and send from your own inbox</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(`Subject: ${email.subject}\n\n${email.body}`, "Email")}
              >
                <Copy className="size-3.5" />
                Copy email
              </Button>
            </div>
            <Input readOnly value={email.subject} className="text-xs font-medium" aria-label="Email subject" />
            <Textarea readOnly value={email.body} rows={12} className="text-xs" aria-label="Email body" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
