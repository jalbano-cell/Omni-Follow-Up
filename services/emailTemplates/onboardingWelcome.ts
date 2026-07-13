/**
 * The agency's own handoff message to a freshly-provisioned client — sent by
 * the agency itself (copy/paste, see app/admin/actions.ts's
 * provisionNewWorkspaceAction), never through the app's own email sending.
 * Unlike services/emailTemplates/acknowledgment.ts's per-tenant, DB-
 * customizable templates, this is one fixed message with no per-business
 * override — there's only one agency, and the client hasn't connected
 * Gmail yet at this point (that's literally what step 2 walks them into),
 * so there's no tenant Gmail connection this could route through anyway.
 */

export interface OnboardingWelcomeEmail {
  subject: string;
  body: string;
}

export function buildOnboardingWelcomeEmail(input: {
  ownerName: string;
  businessName: string;
  claimUrl: string;
  agencyOwnerName: string;
}): OnboardingWelcomeEmail {
  const firstName = input.ownerName.split(" ")[0] || input.ownerName;

  return {
    subject: "Your Omni Follow Up workspace is ready",
    body: [
      `Hi ${firstName},`,
      `Your Omni Follow Up workspace for ${input.businessName} is set up and ready. Omni Follow Up keeps track of every estimate you send and makes sure the ones that go quiet get a timely follow-up — so fewer jobs slip through the cracks.`,
      `Here's what to do:`,
      `1. Set your password. Click your link to get started: ${input.claimUrl}`,
      `2. Connect your Google account. You'll see one screen asking for Gmail and Calendar access — that's your own inbox, not a shared one. It's how Omni Follow Up sends follow-ups from your own email address (so they look like they came from you, because they did) and drops a reminder on your calendar when one's ready for you to check. We never see your Google password, and nothing goes out to a customer until you personally click Approve.`,
      `3. Set your follow-up schedule. Just tell it how many days to wait before nudging a customer who's gone quiet — takes about 30 seconds, and you can change it anytime later.`,
      `That's it — you'll land on your dashboard ready to start adding estimates.`,
      `Questions, or something not working right? Just reply to this email — happy to help.`,
      `Talk soon,\n${input.agencyOwnerName}`,
    ].join("\n\n"),
  };
}
