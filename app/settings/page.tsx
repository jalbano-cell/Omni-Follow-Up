import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getBusinessById, getEffectiveCadenceDays } from "@/services/business";
import { getCurrentBusinessId, getCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { email } = await getCurrentSession();
  const businessId = await getCurrentBusinessId();
  const business = await getBusinessById(businessId);

  const airtableConfigured = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const cadence = getEffectiveCadenceDays(
    business ?? { followUpCadenceSentDays: null, followUpCadenceFollowUp1Days: null, followUpCadenceFollowUp2Days: null }
  );

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
            <p className="text-sm font-medium text-foreground">{business?.businessName ?? "Your Business"}</p>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Set <code className="rounded bg-muted px-1 py-0.5">AIRTABLE_API_KEY</code> and{" "}
              <code className="rounded bg-muted px-1 py-0.5">AIRTABLE_BASE_ID</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.local</code> — see{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.example</code> for the template.
              Restart the dev server after changes.
            </p>
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
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              <XCircle className="size-4 text-destructive" />
              <span className="text-sm text-foreground">Not connected</span>
              <Badge variant="secondary" className="ml-auto">
                Coming soon
              </Badge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Self-serve Gmail connection (per business, via Google OAuth) is landing in the next update.
              Follow-ups can still be drafted, approved, and edited — sending is paused until this ships.
            </p>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Follow-up cadence</CardTitle>
            <CardDescription>Days after each stage before the next follow-up is due.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <ul className="divide-y divide-border">
              {Object.entries(cadence).map(([stage, days]) => (
                <li key={stage} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-foreground">{stage}</span>
                  <span className="text-muted-foreground">{days} days</span>
                </li>
              ))}
            </ul>
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
