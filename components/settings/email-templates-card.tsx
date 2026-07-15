"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Check, RotateCcw, Eye } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { updateEmailTemplateAction, resetEmailTemplateAction } from "@/app/settings/actions";
import { renderTemplate, sampleMergeVariables } from "@/services/emailTemplates/render";
import { EMAIL_TEMPLATE_LABELS, EMAIL_TEMPLATE_MERGE_VARIABLES } from "@/config/constants";
import type { EmailTemplate } from "@/types";

function TemplateItem({ template, businessName }: { template: EmailTemplate; businessName: string }) {
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(false);
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);

  function save() {
    startTransition(async () => {
      await updateEmailTemplateAction(template.key, subject, body);
      setIsEditing(false);
      toast.success("Template updated");
    });
  }

  function cancel() {
    setSubject(template.subject);
    setBody(template.body);
    setIsEditing(false);
  }

  function reset() {
    startTransition(async () => {
      await resetEmailTemplateAction(template.key);
      setIsEditing(false);
      toast.success("Reverted to default");
    });
  }

  const preview = renderTemplate({ subject, body }, sampleMergeVariables(businessName));

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-foreground">{EMAIL_TEMPLATE_LABELS[template.key]}</span>
        <Badge variant={template.isCustomized ? "default" : "secondary"}>
          {template.isCustomized ? "Customized" : "Default"}
        </Badge>
      </div>

      {isEditing ? (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`subject-${template.key}`} className="text-xs">
              Subject
            </Label>
            <Input id={`subject-${template.key}`} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`body-${template.key}`} className="text-xs">
              Body
            </Label>
            <Textarea id={`body-${template.key}`} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">
            Merge variables: {EMAIL_TEMPLATE_MERGE_VARIABLES.map((v) => `{{${v}}}`).join(" · ")}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={save} disabled={isPending}>
              <Check className="size-3.5" />
              Save
            </Button>
            <Dialog>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Eye className="size-3.5" />
                Preview
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{EMAIL_TEMPLATE_LABELS[template.key]} — preview</DialogTitle>
                  <DialogDescription>Rendered with sample data — nothing here is actually sent.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">{preview.subject}</p>
                  <p className="whitespace-pre-line text-sm text-foreground/90">{preview.body}</p>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="ghost" onClick={cancel} disabled={isPending}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">{template.subject}</p>
          <p className="whitespace-pre-line text-sm text-muted-foreground">{template.body}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Dialog>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Eye className="size-3.5" />
                Preview
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>{EMAIL_TEMPLATE_LABELS[template.key]} — preview</DialogTitle>
                  <DialogDescription>Rendered with sample data — nothing here is actually sent.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold text-foreground">{preview.subject}</p>
                  <p className="whitespace-pre-line text-sm text-foreground/90">{preview.body}</p>
                </div>
              </DialogContent>
            </Dialog>
            {template.isCustomized && (
              <Button size="sm" variant="ghost" onClick={reset} disabled={isPending}>
                <RotateCcw className="size-3.5" />
                Reset to default
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailTemplatesCard({
  templates,
  businessName,
  estimatesEnabled = true,
}: {
  templates: EmailTemplate[];
  businessName: string;
  /**
   * Hides followup_1/followup_2/final_followup entirely for a workspace the
   * agency has restricted to productMode "appointments_only" — those
   * templates back the Estimate Follow-up Queue (services/followupSender.ts),
   * which such a workspace can never reach or send through
   * (lib/session.ts's requireEstimatesEnabled gates every Follow-up page and
   * Server Action), so editing them would just be dead configuration. The
   * acknowledgment template stays editable regardless — it's the
   * instant lead-received email, sent for every product mode.
   */
  estimatesEnabled?: boolean;
}) {
  const visibleTemplates = estimatesEnabled ? templates : templates.filter((t) => t.key === "acknowledgment");

  return (
    <>
      <CardHeader className="px-0">
        <CardTitle className="text-base">Email templates</CardTitle>
        <CardDescription>
          {estimatesEnabled
            ? "Customize the acknowledgment and follow-up emails sent to customers. Preview before saving."
            : "Customize the acknowledgment email sent to customers. Preview before saving."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-0">
        {visibleTemplates.map((template) => (
          <TemplateItem key={template.key} template={template} businessName={businessName} />
        ))}
      </CardContent>
    </>
  );
}
