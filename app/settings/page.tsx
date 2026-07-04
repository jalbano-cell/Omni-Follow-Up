import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/estimates/submit-button";
import { getEffectiveCadenceDays } from "@/services/business";
import { updateCadenceAction, disconnectGoogleAction } from "@/app/settings/actions";
import { requireOnboardedBusiness, getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleError?: string }>;
}) {
  const { googleError } = await searchParams;
  const { email } = await getCurrentSession();
  const business = await requireOnboardedBusiness();

  const airtableConfigured = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const googleConnected = Boolean(business.googleRefreshTokenEnc);
  const cadence = getEffectiveCadenceDays(business);

  return (
    <>
      <PageHeader title="Settings" description="Connection status and follow-up defaults." />

      <div className="flex flex-col gap-6">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your business and login.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-sm font-medium text-foreground">{business.businessName}</p>
            <p className="mt-1 text-xs text-muted-foreground">Signed in as {email}</p>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Airtable connection</CardTitle>
            <CardDescription>
              Data source for estimates and follow-ups. Configured via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              {airtableConfigured ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm text-foreground">Connected</span>
                  <Badge variant="success" className="ml-auto">
                    AIRTABLE_API_KEY & AIRTABLE_BASE_ID set
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" />
                  <span className="text-sm text-foreground">Not connected</span>
                  <Badge variant="destructive" className="ml-auto">
                    Missing env vars
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Gmail connection</CardTitle>
            <CardDescription>
              Used to send approved follow-ups. Nothing sends until you click Send Email in the queue.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            {googleError && (
              <p className="mb-3 text-xs text-destructive">
                Something went wrong connecting Google. Please try again.
              </p>
            )}
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              {googleConnected ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm text-foreground">Connected</span>
                  <Badge variant="success" className="ml-auto">
                    {business.googleConnectedEmail}
                  </Badge>
                </>
              ) : (
                <>
                  <XCircle className="size-4 text-destructive" />
                  <span className="text-sm text-foreground">Not connected</span>
                  <Badge variant="destructive" className="ml-auto">
                    Sending paused
                  </Badge>
                </>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              {googleConnected ? (
                <>
                  <Button size="sm" variant="outline" render={<Link href="/api/oauth/google/start?returnTo=/settings" />}>
                    Reconnect
                  </Button>
                  <form action={disconnectGoogleAction}>
                    <Button size="sm" variant="ghost" type="submit">
                      Disconnect
                    </Button>
                  </form>
                </>
              ) : (
                <Button size="sm" render={<Link href="/api/oauth/google/start?returnTo=/settings" />}>
                  Connect Google Account
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Follow-up cadence</CardTitle>
            <CardDescription>Days after each stage before the next follow-up is due.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateCadenceAction} className="flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sentDays" className="text-xs">
                    Sent → 1st follow-up
                  </Label>
                  <Input id="sentDays" name="sentDays" type="number" min={1} defaultValue={cadence.Sent} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="followUp1Days" className="text-xs">
                    → 2nd follow-up
                  </Label>
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
                  <Label htmlFor="followUp2Days" className="text-xs">
                    → 3rd follow-up
                  </Label>
                  <Input
                    id="followUp2Days"
                    name="followUp2Days"
                    type="number"
                    min={1}
                    defaultValue={cadence["Follow-up 2"]}
                    required
                  />
                </div>
              </div>
              <SubmitButton>Save cadence</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Out of scope</CardTitle>
            <CardDescription>Deliberately not part of this product.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ul className="list-inside list-disc text-sm text-muted-foreground">
              <li>CRM-style contact/pipeline management beyond what&apos;s on an estimate</li>
              <li>Reading replies — threading keeps outbound follow-ups in the right Gmail thread, but the app doesn&apos;t yet surface customer responses</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
