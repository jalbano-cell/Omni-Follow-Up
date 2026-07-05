import { FileText } from "lucide-react";
import { EstimateForm } from "@/components/estimates/estimate-form";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { SubmitButton } from "@/components/estimates/submit-button";
import { skipFirstEstimateAction } from "@/app/onboarding/first-estimate/actions";

export const dynamic = "force-dynamic";

export default function OnboardingFirstEstimatePage() {
  return (
    <>
      <StepIndicator currentStep={5} />
      <div className="mb-5 flex flex-col items-center gap-3 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <FileText className="size-6" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">Add your first estimate</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            OmniFollowUp needs at least one estimate to start suggesting follow-ups. Add one now, or skip and
            add it later from Estimates.
          </p>
        </div>
      </div>

      <EstimateForm onboarding />

      <form action={skipFirstEstimateAction} className="mt-4 flex justify-center">
        <SubmitButton variant="ghost" size="sm">
          Skip for now
        </SubmitButton>
      </form>
    </>
  );
}
