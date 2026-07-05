import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IntakeKeyCard } from "@/components/settings/intake-key-card";
import { LeadSourcesCard } from "@/components/settings/lead-sources-card";
import { EmailTemplatesCard } from "@/components/settings/email-templates-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SubmitButton } from "@/components/estimates/submit-button";
import {
  getEffectiveCadenceDays,
  getEffectiveCalendarId,
  getEffectiveTimezone,
  getEffectiveWorkingHours,
  getEffectiveAutoBooking,
  getEffectiveNotifyOnNewLead,
  getEffectiveNotifyOnReply,
  getEffectiveGmailLeadMonitoring,
} from "@/services/business";
import { listEmailTemplates } from "@/services/emailTemplateService";
import { getEffectivePlan } from "@/services/subscriptionService";
import {
  updateCadenceAction,
  disconnectGoogleAction,
  updateBusinessProfileAction,
  updateCalendarIdAction,
  updateScheduleAction,
  updateEmailSignatureAction,
  updateAppointmentPreferencesAction,
  updateWebhookUrlAction,
  updateNotificationPreferencesAction,
  updateGmailLeadMonitoringAction,
} from "@/app/settings/actions";
import { requireOnboardedBusiness, getCurrentSession } from "@/lib/session";
import { SERVICE_TYPES, TIMEZONE_OPTIONS } from "@/config/constants";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleError?: string }>;
}) {
  const { googleError } = await searchParams;
  const { email } = await getCurrentSession();
  const business = await requireOnboardedBusiness();

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const intakeEndpointUrl = `${protocol}://${host}/api/intake`;
  const webhookEndpointUrl = `${protocol}://${host}/api/v1/webhooks/leads`;

  const databaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const googleConnected = Boolean(business.googleRefreshTokenEnc);
  const cadence = getEffectiveCadenceDays(business);
  const calendarId = getEffectiveCalendarId(business);
  const timezone = getEffectiveTimezone(business);
  const workingHours = getEffectiveWorkingHours(business);
  const autoBookAppointments = getEffectiveAutoBooking(business);
  const notifyOnNewLead = getEffectiveNotifyOnNewLead(business);
  const notifyOnReply = getEffectiveNotifyOnReply(business);
  const monitorGmailInbox = getEffectiveGmailLeadMonitoring(business);
  const emailTemplates = await listEmailTemplates(business.id);
  const plan = await getEffectivePlan(business.id);

  return (
    <>
      <PageHeader title="Settings" description="Business profile, connections, and follow-up defaults." />

      <div className="flex flex-col gap-6">
        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Account</CardTitle>
            <CardDescription>Your business profile and login.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <p className="mb-3 text-xs text-muted-foreground">Signed in as {email}</p>
            <form action={updateBusinessProfileAction} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="businessName" className="text-xs">
                    Business name
                  </Label>
                  <Input id="businessName" name="businessName" defaultValue={business.businessName} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="industry" className="text-xs">
                    Industry
                  </Label>
                  <Select name="industry" defaultValue={business.industry ?? SERVICE_TYPES[0]} required>
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
              </div>
              <SubmitButton>Save profile</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Plan</CardTitle>
            <CardDescription>Every business is on the Free plan for now — paid plans aren&apos;t live yet.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">{plan.name}</span>
              <Badge variant="secondary" className="ml-auto">
                {plan.maxLeadsPerMonth ? `${plan.maxLeadsPerMonth} leads/mo` : "Unlimited leads"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <EmailTemplatesCard templates={emailTemplates} businessName={business.businessName} />

        <LeadSourcesCard
          intakeApiKeyPresent={Boolean(business.intakeApiKey)}
          webhookEndpointUrl={webhookEndpointUrl}
          gmailConnected={googleConnected}
          monitorGmailInbox={monitorGmailInbox}
        />

        <IntakeKeyCard apiKey={business.intakeApiKey} endpointUrl={intakeEndpointUrl} />

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Database connection</CardTitle>
            <CardDescription>
              Data source for leads, estimates, and follow-ups. Configured via environment variables.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
              {databaseConfigured ? (
                <>
                  <CheckCircle2 className="size-4 text-success" />
                  <span className="text-sm text-foreground">Connected</span>
                  <Badge variant="success" className="ml-auto">
                    Supabase env vars set
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
            <form action={updateGmailLeadMonitoringAction} className="mt-4 border-t border-border pt-4">
              <label className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="monitorGmailInbox"
                  defaultChecked={monitorGmailInbox}
                  disabled={!googleConnected}
                  className="mt-0.5 size-4 shrink-0 rounded border-border disabled:opacity-50"
                />
                <span>
                  <span className="block font-medium text-foreground">Monitor Gmail inbox for new customer inquiries</span>
                  <span className="block text-xs text-muted-foreground">
                    Once a day, scans this inbox for messages that aren&apos;t already part of an existing Lead or
                    Estimate thread and creates a new Lead (source &quot;Gmail&quot;) for each one. Off by default.
                    {!googleConnected && " Requires Gmail connected above."}
                  </span>
                </span>
              </label>
              <div className="mt-3">
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Google Calendar connection</CardTitle>
            <CardDescription>
              Reminders are created on this calendar when a follow-up is drafted, via the same Google account
              connected above.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
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
                    Reminders paused
                  </Badge>
                </>
              )}
            </div>
            <form action={updateCalendarIdAction} className="mt-3 flex flex-col gap-1.5">
              <Label htmlFor="calendarId" className="text-xs">
                Calendar ID
              </Label>
              <div className="flex gap-2">
                <Input id="calendarId" name="calendarId" defaultValue={calendarId} placeholder="primary" />
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Appointment preferences</CardTitle>
            <CardDescription>
              When a customer&apos;s message requests a specific date/time, should it book automatically or wait for
              your approval?
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateAppointmentPreferencesAction} className="flex flex-col gap-4">
              <label className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="autoBookAppointments"
                  defaultChecked={autoBookAppointments}
                  className="mt-0.5 size-4 shrink-0 rounded border-border"
                />
                <span>
                  <span className="font-medium text-foreground">Automatically book appointments when the requested time is open</span>
                  <br />
                  <span className="text-xs text-muted-foreground">
                    Off by default — leaves a reviewable recommendation on the Lead instead, with an Approve button.
                  </span>
                </span>
              </label>
              <SubmitButton>Save preferences</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Webhook URL</CardTitle>
            <CardDescription>
              We&apos;ll POST a JSON payload here on key events (new lead, estimate booked/lost) — best-effort, no
              retries. See docs/api.md for the payload shape.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateWebhookUrlAction} className="flex flex-col gap-1.5">
              <Label htmlFor="outboundWebhookUrl" className="text-xs">
                Webhook URL
              </Label>
              <div className="flex gap-2">
                <Input
                  id="outboundWebhookUrl"
                  name="outboundWebhookUrl"
                  type="url"
                  placeholder="https://example.com/webhooks/omnifollowup"
                  defaultValue={business.outboundWebhookUrl ?? ""}
                />
                <SubmitButton>Save</SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Notification preferences</CardTitle>
            <CardDescription>Which events email or notify you in-app.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateNotificationPreferencesAction} className="flex flex-col gap-3">
              <label className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="notifyOnNewLead"
                  defaultChecked={notifyOnNewLead}
                  className="mt-0.5 size-4 shrink-0 rounded border-border"
                />
                <span className="font-medium text-foreground">Email me when a new lead arrives</span>
              </label>
              <label className="flex items-start gap-2.5 rounded-lg border border-border px-4 py-3 text-sm">
                <input
                  type="checkbox"
                  name="notifyOnReply"
                  defaultChecked={notifyOnReply}
                  className="mt-0.5 size-4 shrink-0 rounded border-border"
                />
                <span className="font-medium text-foreground">Notify me in-app when a customer replies</span>
              </label>
              <SubmitButton>Save preferences</SubmitButton>
            </form>
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
            <CardTitle className="text-base">Timezone & working hours</CardTitle>
            <CardDescription>Used to schedule Calendar reminders at the right local time.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateScheduleAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="timezone" className="text-xs">
                  Timezone
                </Label>
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
                  <Label htmlFor="workingHoursStart" className="text-xs">
                    Working hours start
                  </Label>
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
                  <Label htmlFor="workingHoursEnd" className="text-xs">
                    Working hours end
                  </Label>
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
              <SubmitButton>Save schedule</SubmitButton>
            </form>
          </CardContent>
        </Card>

        <Card className="py-5">
          <CardHeader className="px-5">
            <CardTitle className="text-base">Email signature</CardTitle>
            <CardDescription>Appended to the bottom of every follow-up email you send.</CardDescription>
          </CardHeader>
          <CardContent className="px-5">
            <form action={updateEmailSignatureAction} className="flex flex-col gap-4">
              <Textarea
                name="emailSignature"
                defaultValue={business.emailSignature ?? ""}
                placeholder={`Thanks,\n${business.ownerName}\n${business.businessName}`}
                rows={4}
              />
              <SubmitButton>Save signature</SubmitButton>
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
              <li>Two-way calendar scheduling — reminders are output-only, never booking or checking availability</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
