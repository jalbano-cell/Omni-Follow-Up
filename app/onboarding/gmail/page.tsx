import Link from "next/link";
import { Mail, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { getBusinessById } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingGmailPage({
  searchParams,
}: {
  searchParams: Promise<{ googleError?: string }>;
}) {
  const { googleError } = await searchParams;
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  const connected = Boolean(business?.googleRefreshTokenEnc);

  return (
    <>
      <StepIndicator currentStep={2} />
      <Card className="py-6">
        <CardContent className="flex flex-col items-center gap-4 px-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="size-6" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Connect your Gmail</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              FollowUpQuote sends approved follow-ups from your own Gmail address and can later show
              customer replies in the same thread. Nothing sends automatically — you approve every email
              before it goes out.
            </p>
          </div>

          {googleError && (
            <p className="text-xs text-destructive">
              Something went wrong connecting Google. Please try again.
            </p>
          )}

          {connected ? (
            <>
              <p className="text-sm text-success">Connected as {business?.googleConnectedEmail}</p>
              <Button render={<Link href="/onboarding/cadence" />} className="w-full">
                Continue <ArrowRight className="size-4" />
              </Button>
            </>
          ) : (
            <Button render={<Link href="/api/oauth/google/start?returnTo=/onboarding/cadence" />} className="w-full">
              Connect Google Account
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  );
}
