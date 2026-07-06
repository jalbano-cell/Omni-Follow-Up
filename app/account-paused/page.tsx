import { getCurrentSession } from "@/lib/session";
import { getBusinessById } from "@/services/business";
import { Logo } from "@/components/layout/logo";
import { logoutAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/**
 * The one page a non-'active' workspace (services/business.ts's
 * hasActiveEntitlement) can reach — lib/session.ts's requireOnboardedBusiness
 * redirects here for everything else, since access is agency-provisioned and
 * there's no free/fallback tier. Reachable by anyone with a valid session
 * (getCurrentSession() still redirects an unauthenticated visitor to /login),
 * deliberately not going through requireOnboardedBusiness itself — that would
 * just redirect back here in a loop.
 */
export default async function AccountPausedPage() {
  const { businessId } = await getCurrentSession();
  const business = await getBusinessById(businessId);

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-8 flex flex-col items-center gap-2">
          <Logo size="md" withWordmark={false} />
          <h1 className="font-heading text-lg font-semibold tracking-tight text-foreground">OmniFollowUp</h1>
        </div>

        <h2 className="mb-2 text-base font-semibold text-foreground">Your account is paused</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          {business?.businessName ? `${business.businessName}'s` : "This"} access isn&apos;t active right now. Contact
          your account team to resolve this.
        </p>

        <form action={logoutAction}>
          <Button type="submit" variant="outline" size="sm">
            Log out
          </Button>
        </form>
      </div>
    </div>
  );
}
