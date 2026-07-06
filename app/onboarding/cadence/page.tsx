import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/estimates/submit-button";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { saveCadenceAction } from "@/app/onboarding/cadence/actions";
import { getBusinessById, getEffectiveCadenceDays } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function OnboardingCadencePage() {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  const cadence = getEffectiveCadenceDays(
    business ?? { followUpCadenceSentDays: null, followUpCadenceFollowUp1Days: null, followUpCadenceFollowUp2Days: null }
  );

  return (
    <>
      <StepIndicator currentStep={3} />
      <Card className="py-6">
        <CardContent className="px-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">Follow-up schedule</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                How many days to wait after each stage before the next follow-up is due. You can change this
                later in Settings.
              </p>
            </div>
          </div>

          <form action={saveCadenceAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sentDays">Days after sending before the first follow-up</Label>
              <Input id="sentDays" name="sentDays" type="number" min={1} defaultValue={cadence.Sent} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followUp1Days">Days before the second follow-up</Label>
              <Input
                id="followUp1Days"
                name="followUp1Days"
                type="number"
                min={1}
                defaultValue={cadence["Follow-up 1"]}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="followUp2Days">Days before the third (final) follow-up</Label>
              <Input
                id="followUp2Days"
                name="followUp2Days"
                type="number"
                min={1}
                defaultValue={cadence["Follow-up 2"]}
                required
              />
            </div>

            <SubmitButton className="mt-1 w-full">Continue</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
