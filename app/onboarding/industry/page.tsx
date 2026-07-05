import { Briefcase } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/estimates/submit-button";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { saveIndustryAction } from "@/app/onboarding/industry/actions";
import { getBusinessById } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { SERVICE_TYPES } from "@/config/constants";

export const dynamic = "force-dynamic";

export default async function OnboardingIndustryPage() {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);

  return (
    <>
      <StepIndicator currentStep={2} />
      <Card className="py-6">
        <CardContent className="px-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Briefcase className="size-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">What&apos;s your industry?</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Helps us tailor the estimate form. You can change this later in Settings.
              </p>
            </div>
          </div>

          <form action={saveIndustryAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Select name="industry" defaultValue={business?.industry ?? SERVICE_TYPES[0]} required>
                <SelectTrigger id="industry" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SubmitButton className="mt-1 w-full">Continue</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
