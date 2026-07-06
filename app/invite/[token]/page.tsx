import { getTeamMemberByInviteToken, isInviteAcceptable } from "@/services/userService";
import { getBusinessById } from "@/services/business";
import { Logo } from "@/components/layout/logo";
import { InviteAcceptForm } from "@/components/auth/invite-accept-form";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const member = await getTeamMemberByInviteToken(token);
  const acceptable = isInviteAcceptable(member);
  const business = member ? await getBusinessById(member.workspaceId) : null;

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">OmniFollowUp</h1>
          {acceptable && business ? (
            <p className="text-sm text-muted-foreground">
              {member!.role === "owner" ? "Activate" : "Join"}{" "}
              <span className="font-medium text-foreground">{business.businessName}</span> on OmniFollowUp
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Invite link</p>
          )}
        </div>

        {acceptable ? (
          <InviteAcceptForm token={token} email={member!.email} error={error} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            This invite link is invalid or has expired. Ask the business owner to send a new one from Settings.
          </p>
        )}
      </div>
    </div>
  );
}
