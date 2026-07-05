import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/estimates/submit-button";
import { createEstimateAction } from "@/app/estimates/actions";
import { SERVICE_TYPES } from "@/config/constants";
import { todayIso } from "@/lib/date";

export function EstimateForm({ onboarding = false }: { onboarding?: boolean }) {
  return (
    <Card className="max-w-xl py-6">
      <CardContent className="px-6">
        <form action={createEstimateAction} className="flex flex-col gap-5">
          {onboarding && <input type="hidden" name="onboarding" value="1" />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerName">Customer name</Label>
            <Input id="customerName" name="customerName" placeholder="Jamie Rivera" required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="customerEmail">Email</Label>
            <Input
              id="customerEmail"
              name="customerEmail"
              type="email"
              placeholder="jamie@email.com"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="serviceType">Service type</Label>
              <Select name="serviceType" defaultValue={SERVICE_TYPES[0]} required>
                <SelectTrigger id="serviceType" className="w-full">
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

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="estimateValue">Estimate value ($)</Label>
              <Input
                id="estimateValue"
                name="estimateValue"
                type="number"
                min={0}
                step="0.01"
                placeholder="2400"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dateSent">Date sent</Label>
            <Input
              id="dateSent"
              name="dateSent"
              type="date"
              defaultValue={todayIso()}
              max={todayIso()}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" placeholder="Any context worth remembering..." rows={3} />
          </div>

          <div className="mt-1 flex justify-end">
            <SubmitButton>Save estimate</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
