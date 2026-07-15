import Link from "next/link";
import { headers } from "next/headers";
import {
  Building2,
  Mail,
  Inbox,
  Repeat,
  FileText,
  Bell,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LeadSourcesCard } from "@/components/settings/lead-sources-card";
import { EmailTemplatesCard } from "@/components/settings/email-templates-card";
import { TeamCard } from "@/components/settings/team-card";
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
  getEffectiveNotifyOnNewLead,
  getEffectiveNotifyOnReply,
  getEffectiveGmailLeadMonitoring,
  getEffectiveEmailAccentColor,
} from "@/services/business";
import { listEmailTemplates } from "@/services/emailTemplateService";
import { getTeamMembersForBusiness } from "@/services/userService";
import { getMailboxConnection } from "@/services/mailboxConnections";
import {
  updateCadenceAction,
  disconnectGoogleAction,
  disconnectMicrosoftAction,
  updateBusinessProfileAction,
  updateCalendarIdAction,
  updateScheduleAction,
  updateEmailSignatureAction,
  updateEmailBrandingAction,
  updateAppointmentLifecycleAction,
  updateNotificationPreferencesAction,
  updateGmailLeadMonitoringAction,
} from "@/app/settings/actions";
import { requireOwner, getCurrentSession } from "@/lib/session";
import { SERVICE_TYPES, TIMEZONE_OPTIONS, MAX_TEAM_SEATS } from "@/config/constants";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ googleError?: string; microsoftError?: string }>;
}) {
  const { googleError, microsoftError } = await searchParams;
  const { email } = await getCurrentSession();
  const business = await requireOwner();

  const host = (await headers()).get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const webhookEndpointUrl = `${protocol}://${host}/api/v1/webhooks/leads`;
  const inviteBaseUrl = `${protocol}://${host}`;

  const estimatesEnabled = business.productMode !== "appointments_only";
  const appointmentsEnabled = business.productMode !== "estimates_only";
  const googleConnected = Boolean(business.googleRefreshTokenEnc);
  const cadence = getEffectiveCadenceDays(business);
  const calendarId = getEffectiveCalendarId(business);
  const timezone = getEffectiveTimezone(business);
  const workingHours = getEffectiveWorkingHours(business);
  const notifyOnNewLead = getEffectiveNotifyOnNewLead(business);
  const notifyOnReply = getEffectiveNotifyOnReply(business);
  const monitorGmailInbox = getEffectiveGmailLeadMonitoring(business);
  const emailTemplates = await listEmailTemplates(business.id);
  const teamMembers = await getTeamMembersForBusiness(business.id);
  const microsoftConnection = await getMailboxConnection(business.id, "microsoft");
  const rebookOverridesText = Object.entries(business.rebookIntervalOverrides)
    .map(([serviceType, days]) => `${serviceType}: ${days == null ? "none" : days}`)
    .join("\n");

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

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-semibold text-foreground">Email accent color</p>
            <p className="mb-3 text-xs text-muted-foreground">
              Used as the header color and link color in every automated email you send — the lead acknowledgment,
              appointment emails, and your own new-inquiry notification.
            </p>
            <form action={updateEmailBrandingAction} className="flex items-center gap-3">
              <input
                type="color"
                name="emailAccentColor"
                defaultValue={getEffectiveEmailAccentColor(business)}
                className="h-9 w-14 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
              />
              <SubmitButton>Save color</SubmitButton>
            </form>
          </div>
        </SettingsSection>

        <SettingsSection value="team" icon={Users} title="Team" description="Invite teammates to share this workspace">
          <TeamCard
            ownerName={business.ownerName}
            ownerEmail={business.ownerEmail}
            members={teamMembers}
            maxUsers={MAX_TEAM_SEATS}
            inviteBaseUrl={inviteBaseUrl}
          />
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

          {estimatesEnabled && (
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
          )}
          {!estimatesEnabled && (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              This workspace only accepts leads and bookings through the website form — Gmail inbox scanning is
              unavailable for appointments-only workspaces.
            </p>
          )}
        </SettingsSection>

        {estimatesEnabled && (
        <SettingsSection
          value="microsoft-integration"
          icon={Mail}
          title="Microsoft Integration"
          description="Connect Outlook or Microsoft 365 for sending and replies"
        >
          <p className="text-sm text-muted-foreground">
            An alternative to Gmail for sending approved follow-ups and reading replies.
            {googleConnected && " Gmail is already connected above, so it's used for sending and replies — connecting Microsoft too won't change that unless Gmail is disconnected."}
          </p>

          {microsoftError && (
            <p className="text-xs text-destructive">Something went wrong connecting Microsoft. Please try again.</p>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-border px-4 py-3">
            {microsoftConnection ? (
              <>
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-sm text-foreground">Connected</span>
                <Badge variant="success" className="ml-auto">
                  {microsoftConnection.connectedEmail}
                </Badge>
              </>
            ) : (
              <>
                <XCircle className="size-4 text-destructive" />
                <span className="text-sm text-foreground">Not connected</span>
                <Badge variant="destructive" className="ml-auto">
                  Sending &amp; replies unavailable
                </Badge>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {microsoftConnection ? (
              <>
                <Button size="sm" variant="outline" render={<Link href="/api/oauth/microsoft/start?returnTo=/settings" />}>
                  Reconnect
                </Button>
                <form action={disconnectMicrosoftAction}>
                  <Button size="sm" variant="ghost" type="submit">
                    Disconnect
                  </Button>
                </form>
              </>
            ) : (
              <Button size="sm" render={<Link href="/api/oauth/microsoft/start?returnTo=/settings" />}>
                Connect Microsoft
              </Button>
            )}
          </div>
        </SettingsSection>
        )}

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
            estimatesEnabled={estimatesEnabled}
          />
        </SettingsSection>

        {estimatesEnabled && (
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
        )}

        <SettingsSection
          value="email-templates"
          icon={FileText}
          title="Email Templates"
          description="Customize customer email templates"
        >
          <EmailTemplatesCard templates={emailTemplates} businessName={business.businessName} estimatesEnabled={estimatesEnabled} />
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

        {appointmentsEnabled && (
        <SettingsSection
          value="appointment-preferences"
          icon={CalendarClock}
          title="Appointment Lifecycle"
          description="Review requests, rebook and pre-appointment reminders, and CASL compliance"
        >
          <p className="text-sm text-muted-foreground">
            Every requested appointment always waits for your approval on the{" "}
            <Link href="/appointments" className="text-primary hover:underline">
              Appointments
            </Link>{" "}
            page — nothing books automatically. These settings control what happens afterward: the day-after review
            request and the recurring rebook reminder.
          </p>
          <form action={updateAppointmentLifecycleAction} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="googleReviewUrl" className="text-xs">
                  Google review link
                </Label>
                <Input
                  id="googleReviewUrl"
                  name="googleReviewUrl"
                  type="url"
                  defaultValue={business.googleReviewUrl ?? ""}
                  placeholder="https://g.page/r/.../review"
                />
                <p className="text-xs text-muted-foreground">
                  Left blank, the day-after review request is skipped — there&apos;d be nowhere to send the customer.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="rebookIntervalDays" className="text-xs">
                  Rebook reminder (days after completion)
                </Label>
                <Input
                  id="rebookIntervalDays"
                  name="rebookIntervalDays"
                  type="number"
                  min={1}
                  defaultValue={business.rebookIntervalDays ?? ""}
                  placeholder="e.g. 49"
                />
                <p className="text-xs text-muted-foreground">Left blank, no rebook reminder sends by default.</p>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="appointmentReminderHoursBefore" className="text-xs">
                Reminder (hours before appointment)
              </Label>
              <Input
                id="appointmentReminderHoursBefore"
                name="appointmentReminderHoursBefore"
                type="number"
                min={1}
                defaultValue={business.appointmentReminderHoursBefore ?? ""}
                placeholder="e.g. 3"
              />
              <p className="text-xs text-muted-foreground">
                Automatically emails the customer this many hours before an approved appointment — left blank,
                defaults to 3 hours. Sends on its own; there&apos;s nothing to approve.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mailingAddress" className="text-xs">
                Mailing address
              </Label>
              <Input
                id="mailingAddress"
                name="mailingAddress"
                defaultValue={business.mailingAddress ?? ""}
                placeholder="123 Main St, Toronto, ON"
              />
              <p className="text-xs text-muted-foreground">
                Included in every automated appointment email&apos;s footer — Canada&apos;s anti-spam law (CASL)
                requires it.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rebookIntervalOverrides" className="text-xs">
                Per-service overrides (optional)
              </Label>
              <Textarea
                id="rebookIntervalOverrides"
                name="rebookIntervalOverrides"
                defaultValue={rebookOverridesText}
                rows={3}
                placeholder={"Grooming: 49\nConsultation: none"}
              />
              <p className="text-xs text-muted-foreground">
                One per line, as &ldquo;Service Type: days&rdquo; — use &ldquo;none&rdquo; to disable the reminder for
                that service even when the default above is set.
              </p>
            </div>

            <SubmitButton>Save appointment lifecycle settings</SubmitButton>
          </form>
        </SettingsSection>
        )}

      </SettingsAccordion>
    </>
  );
}
