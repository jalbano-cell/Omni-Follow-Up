import Link from "next/link";
import { headers } from "next/headers";
import {
  Building2,
  CreditCard,
  Mail,
  Inbox,
  Repeat,
  FileText,
  Bell,
  CalendarClock,
  Webhook,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IntakeKeyCard } from "@/components/settings/intake-key-card";
import { LeadSourcesCard } from "@/components/settings/lead-sources-card";
import { EmailTemplatesCard } from "@/components/settings/email-templates-card";
import { BillingCard } from "@/components/settings/billing-card";
import { SettingsAccordion } from "@/components/settings/settings-accordion";
import { SettingsSection } from "@/components/settings/settings-section";
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
import { getEffectivePlan, getSubscription, getLeadsThisMonthUsage } from "@/services/subscriptionService";
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
  searchParams: Promise<{ googleError?: string; checkout?: "success" | "cancelled" }>;
}) {
  const { googleError, checkout } = await searchParams;
  const { email } = await getCurrentSession();
  const business = await requireOnboardedBusiness();

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const intakeEndpointUrl = `${protocol}://${host}/api/intake`;
  const webhookEndpointUrl = `${protocol}://${host}/api/v1/webhooks/leads`;

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
  const subscription = await getSubscription(business.id);
  const leadsUsedThisMonth = await getLeadsThisMonthUsage(business.id);

  return (
    <>
      <PageHeader title="Settings" description="Business profile, connections, and follow-up defaults." />

      <SettingsAccordion>
        <SettingsSection
          value="business-profile"
          icon={Building2}
          title="Business Profile"
          description="Business information and branding"
        >
          <div>
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
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Time zone &amp; working hours</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Used to schedule Calendar reminders at the right local time.
            </p>
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
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Email signature</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Appended to the bottom of every follow-up email you send.
            </p>
            <form action={updateEmailSignatureAction} className="flex flex-col gap-4">
              <Textarea
                name="emailSignature"
                defaultValue={business.emailSignature ?? ""}
                placeholder={`Thanks,\n${business.ownerName}\n${business.businessName}`}
                rows={4}
              />
              <SubmitButton>Save signature</SubmitButton>
            </form>
          </div>
        </SettingsSection>

        <SettingsSection value="billing" icon={CreditCard} title="Billing" description="Subscription and usage">
          <BillingCard plan={plan} subscription={subscription} leadsUsedThisMonth={leadsUsedThisMonth} checkoutStatus={checkout} />
        </SettingsSection>

        <SettingsSection
          value="google-integrations"
          icon={Mail}
          title="Google Integrations"
          description="Manage Gmail and Calendar connections"
        >
          <p className="text-sm text-muted-foreground">
            Your primary lead source. One connection covers three things: watching your inbox for new customer
            inquiries and creating leads from them, sending approved follow-ups, and creating Calendar reminders
            when a follow-up is drafted.
          </p>

          {googleError && (
            <p className="text-xs text-destructive">Something went wrong connecting Google. Please try again.</p>
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
                  Sending &amp; reminders paused
                </Badge>
              </>
            )}
          </div>
          <div className="flex gap-2">
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

          <form action={updateCalendarIdAction} className="flex flex-col gap-1.5 border-t border-border pt-4">
            <Label htmlFor="calendarId" className="text-xs">
              Calendar ID
            </Label>
            <div className="flex gap-2">
              <Input id="calendarId" name="calendarId" defaultValue={calendarId} placeholder="primary" />
              <SubmitButton>Save</SubmitButton>
            </div>
          </form>

          <form action={updateGmailLeadMonitoringAction} className="border-t border-border pt-4">
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
                  Estimate thread and creates a new Lead (source &quot;Gmail&quot;) for each one. On automatically
                  when Gmail is connected — uncheck to turn it off.
                  {!googleConnected && " Requires Gmail connected above."}
                </span>
              </span>
            </label>
            <div className="mt-3">
              <SubmitButton>Save</SubmitButton>
            </div>
          </form>
        </SettingsSection>

        <SettingsSection
          value="lead-sources"
          icon={Inbox}
          title="Lead Sources"
          description="Manage website, Gmail, manual, CSV, and webhook intake"
        >
          <LeadSourcesCard
            intakeApiKeyPresent={Boolean(business.intakeApiKey)}
            webhookEndpointUrl={webhookEndpointUrl}
            gmailConnected={googleConnected}
            monitorGmailInbox={monitorGmailInbox}
          />
        </SettingsSection>

        <SettingsSection
          value="follow-up-automation"
          icon={Repeat}
          title="Follow-up Automation"
          description="Configure follow-up timing and reminders"
        >
          <p className="text-sm text-muted-foreground">Days after each stage before the next follow-up is due.</p>
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
        </SettingsSection>

        <SettingsSection
          value="email-templates"
          icon={FileText}
          title="Email Templates"
          description="Customize customer email templates"
        >
          <EmailTemplatesCard templates={emailTemplates} businessName={business.businessName} />
        </SettingsSection>

        <SettingsSection
          value="notifications"
          icon={Bell}
          title="Notifications"
          description="Manage email and in-app notifications"
        >
          <p className="text-sm text-muted-foreground">Which events email or notify you in-app.</p>
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
        </SettingsSection>

        <SettingsSection
          value="appointment-preferences"
          icon={CalendarClock}
          title="Appointment Preferences"
          description="Configure appointment booking behavior"
        >
          <p className="text-sm text-muted-foreground">
            When a customer&apos;s message requests a specific date/time, should it book automatically or wait for
            your approval?
          </p>
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
        </SettingsSection>

        <SettingsSection
          value="advanced-integrations"
          icon={Webhook}
          title="Advanced Integrations"
          description="Webhook URLs, Intake API, developer tools"
        >
          <IntakeKeyCard apiKey={business.intakeApiKey} endpointUrl={intakeEndpointUrl} />

          <div className="border-t border-border pt-4">
            <p className="mb-1 text-sm font-semibold text-foreground">Webhook URL</p>
            <p className="mb-3 text-xs text-muted-foreground">
              We&apos;ll POST a JSON payload here on key events (new lead, estimate booked/lost) — best-effort, no
              retries. See docs/api.md for the payload shape.
            </p>
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
          </div>
        </SettingsSection>
      </SettingsAccordion>
    </>
  );
}
