import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/estimates/submit-button";
import { createLeadAction } from "@/app/leads/actions";

export function LeadForm() {
  return (
    <Card className="max-w-xl py-6">
      <CardContent className="px-6">
        <form action={createLeadAction} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Jamie Rivera" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="jamie@email.com" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company">Company (optional)</Label>
              <Input id="company" name="company" placeholder="Acme Co" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="service">Requested service (optional)</Label>
              <Input id="service" name="service" placeholder="Roof repair" />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" placeholder="What they're looking for..." rows={4} required />
          </div>

          <div className="mt-1 flex justify-end">
            <SubmitButton>Save lead</SubmitButton>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
