"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, UserPlus, X } from "lucide-react";
import { CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { inviteTeamMemberAction, removeTeamMemberAction } from "@/app/settings/actions";
import type { TeamMember } from "@/types";

async function copyToClipboard(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(`${label} copied`);
}

export function TeamCard({
  ownerName,
  ownerEmail,
  members,
  maxUsers,
  inviteBaseUrl,
}: {
  ownerName: string;
  ownerEmail: string;
  members: TeamMember[];
  /** Null means unlimited (config/constants.ts's PLAN_MAX_USERS). */
  maxUsers: number | null;
  inviteBaseUrl: string;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const seatsUsed = 1 + members.length;
  const atCap = maxUsers !== null && seatsUsed >= maxUsers;

  function invite(formData: FormData) {
    startTransition(async () => {
      const result = await inviteTeamMemberAction(formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Invite created — copy the link below and send it to them.");
      formRef.current?.reset();
    });
  }

  function remove(memberId: string) {
    setPendingRemoval(memberId);
    startTransition(async () => {
      await removeTeamMemberAction(memberId);
      setPendingRemoval(null);
      toast.success("Removed from the team.");
    });
  }

  return (
    <>
      <CardHeader className="px-0">
        <CardTitle className="text-base">Team</CardTitle>
        <CardDescription>
          {maxUsers === null
            ? `${seatsUsed} seat${seatsUsed === 1 ? "" : "s"} used (unlimited).`
            : `${seatsUsed} of ${maxUsers} seat${maxUsers === 1 ? "" : "s"} used.`}{" "}
          Invited members share full access to estimates, leads, follow-ups, replies, and analytics — Settings
          (this page) stays owner-only.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">{ownerName}</span>
            <span className="text-xs text-muted-foreground">{ownerEmail}</span>
          </div>
          <Badge variant="secondary">Owner</Badge>
        </div>

        {members.map((member) => {
          const isAccepted = Boolean(member.acceptedAt);
          const inviteUrl = member.inviteToken ? `${inviteBaseUrl}/invite/${member.inviteToken}` : null;
          return (
            <div key={member.id} className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">{member.name ?? member.email}</span>
                  <span className="text-xs text-muted-foreground">{member.email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={isAccepted ? "success" : "warning"}>{isAccepted ? "Active" : "Invited"}</Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Remove"
                    disabled={isPending && pendingRemoval === member.id}
                    onClick={() => remove(member.id)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </div>
              {!isAccepted && inviteUrl && (
                <div className="flex gap-2">
                  <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Copy invite link"
                    onClick={() => copyToClipboard(inviteUrl, "Invite link")}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <form ref={formRef} action={invite} className="flex flex-col gap-3 rounded-lg border border-dashed border-border px-4 py-3">
          <Label className="text-xs">Invite a team member</Label>
          {atCap ? (
            <p className="text-xs text-muted-foreground">
              You&apos;ve used every seat on your plan. Upgrade above to invite more.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input name="name" placeholder="Name" required className="text-sm" />
              <Input name="email" type="email" placeholder="Email" required className="text-sm" />
              <Button type="submit" size="sm" disabled={isPending} className="shrink-0">
                <UserPlus className="size-3.5" />
                Invite
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </>
  );
}
