import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/estimates/submit-button";
import { StepIndicator } from "@/components/onboarding/step-indicator";
import { saveHoursAction } from "@/app/onboarding/hours/actions";
import { getBusinessById, getEffectiveTimezone, getEffectiveWorkingHours } from "@/services/business";
import { getCurrentBusinessId } from "@/lib/session";
import { TIMEZONE_OPTIONS } from "@/config/constants";

export const dynamic = "force-dynamic";

export default async function OnboardingHoursPage() {
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);
  const timezone = getEffectiveTimezone(business ?? { timezone: null });
  const workingHours = getEffectiveWorkingHours(business ?? { workingHoursStart: null, workingHoursEnd: null });

  return (
    <>
      <StepIndicator currentStep={4} />
      <Card className="py-6">
        <CardContent className="px-6">
          <div className="mb-5 flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Clock className="size-6" strokeWidth={2} />
            </div>
            <div>
              <h2 className="font-heading text-base font-semibold text-foreground">Business hours & time zone</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Used to schedule Calendar reminders at the right local time. You can change this later in
                Settings.
              </p>
            </div>
          </div>

          <form action={saveHoursAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timezone">Time zone</Label>
              <Select name="timezone" defaultValue={timezone} required>
                <SelectTrigger id="timezone" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workingHoursStart">Working hours start</Label>
                <Input
                  id="workingHoursStart"
                  name="workingHoursStart"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={workingHours.start}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="workingHoursEnd">Working hours end</Label>
                <Input
                  id="workingHoursEnd"
                  name="workingHoursEnd"
                  type="number"
                  min={0}
                  max={23}
                  defaultValue={workingHours.end}
                  required
                />
              </div>
            </div>

            <SubmitButton className="mt-1 w-full">Continue</SubmitButton>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
