import { Progress } from "@/components/ui/progress";

const STEPS = ["Business info", "Connect Google", "Follow-up schedule", "Business hours", "Review"];

/** currentStep is 1-indexed (1 = "Business info", already done via /signup by the time this renders). */
export function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {currentStep} of {STEPS.length}
        </span>
        <span>{STEPS[currentStep - 1]}</span>
      </div>
      <Progress value={(currentStep / STEPS.length) * 100} />
    </div>
  );
}
