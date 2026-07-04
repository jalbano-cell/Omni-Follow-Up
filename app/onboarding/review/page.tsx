import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/estimates/submit-button";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { completeOnboardingAction } from "@/app/onboarding/review/actions";
import { getBusinessById, getEffectiveCadenceDays } from "@/services/business";
import { getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingReviewPage() {
  const { businessId } = await getCurrentSession();
  const business = await getBusinessById(businessId);
  const cadence = getEffectiveCadenceDays(
    business ?? { followUpCadenceSentDays: null, followUpCadenceFollowUp1Days: null, followUpCadenceFollowUp2Days: null }
  );

  const rows: Array<[string, string]> = [
    ["Business", business?.businessName ?? "—"],
    ["Email", business?.ownerEmail ?? "—"],
    ["Gmail", business?.googleConnectedEmail ?? "Not connected"],
    ["Cadence", `${cadence.Sent} / ${cadence["Follow-up 1"]} / ${cadence["Follow-up 2"]} days`],
  ];

  return (
    <>
      <StepIndicator currentStep={4} />
      <Card className="py-6">
        <CardContent className="px-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">Review your setup</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Everything here can be changed later in Settings.
              </p>
            </div>
          </div>

          <dl className="divide-y divide-border rounded-lg border border-border px-4">
            {rows.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>

          <form action={completeOnboardingAction} className="mt-5">
            <SubmitButton className="w-full">Enter dashboard</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
