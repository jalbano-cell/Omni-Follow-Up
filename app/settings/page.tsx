import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FOLLOW_UP_CADENCE_DAYS } from "@/config/constants";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const airtableConfigured = Boolean(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID);
  const gmailConfigured = Boolean(
    process.env.GMAIL_CLIENT_ID &&
      process.env.GMAIL_CLIENT_SECRET &&
      process.env.GMAIL_REFRESH_TOKEN &&
      process.env.GMAIL_USER_EMAIL
  );
  const businessName = process.env.DEFAULT_BUSINESS_NAME ?? "Your Business";

  return (
    <>
      <PageHeader title="Settings" description="Connection status and follow-up defaults." />

      <div className="flex flex-col gap-6">
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
              {gmailConfigured ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm text-foreground">Connected</span>
                  <Badge variant="success" className="ml-auto">
                    {process.env.GMAIL_USER_EMAIL}
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
              Set <code className="rounded bg-muted px-1 py-0.5">GMAIL_CLIENT_ID</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">GMAIL_CLIENT_SECRET</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5">GMAIL_REFRESH_TOKEN</code>, and{" "}
              <code className="rounded bg-muted px-1 py-0.5">GMAIL_USER_EMAIL</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.local</code> — see the README&apos;s
              &quot;Gmail setup&quot; section for the OAuth walkthrough.
            </p>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Business</CardTitle>
            <CardDescription>Default business name attached to new estimates.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="text-sm font-medium text-foreground">{businessName}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Change via <code className="rounded bg-muted px-1 py-0.5">DEFAULT_BUSINESS_NAME</code> in{" "}
              <code className="rounded bg-muted px-1 py-0.5">.env.local</code>.
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
              {Object.entries(FOLLOW_UP_CADENCE_DAYS).map(([stage, days]) => (
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
              <li>Multi-tenant accounts or teams — one shared login per deployment</li>
              <li>CRM-style contact/pipeline management beyond what&apos;s on an estimate</li>
              <li>Reading replies — threading keeps outbound follow-ups in the right Gmail thread, but the app doesn&apos;t know if a customer responded</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
