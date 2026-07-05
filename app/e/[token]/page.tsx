import { verifyEstimateShareToken } from "@/lib/auth";
import { getEstimate } from "@/services/db";
import { getBusinessById } from "@/services/business";
import { getAttachmentsForEstimate, getAttachmentDownloadUrl } from "@/services/estimateAttachmentService";
import { EstimateResponseActions } from "@/components/portal/estimate-response-actions";
import { Logo } from "@/components/layout/logo";
import { formatCurrency, formatDate } from "@/lib/date";

export const dynamic = "force-dynamic";

function PortalMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center px-6 text-center">
      <Logo size="md" withWordmark={false} />
      <h1 className="mt-4 font-heading text-lg font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

/**
 * No-login customer-facing view of a single estimate — authenticated purely
 * by the signed share token in the URL (see lib/auth.ts's
 * verifyEstimateShareToken), not a session. Read-only except for the
 * Accept/Decline actions, which re-verify the token server-side themselves
 * (see app/e/actions.ts) rather than trusting anything from the page.
 */
export default async function CustomerPortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await verifyEstimateShareToken(token);

  if (!payload) {
    return (
      <PortalMessage
        title="This link is no longer valid"
        description="It may have expired. Contact the business directly for an up-to-date copy of your estimate."
      />
    );
  }

  const [estimate, business] = await Promise.all([
    getEstimate(payload.businessId, payload.estimateId),
    getBusinessById(payload.businessId),
  ]);

  if (!estimate || !business) {
    return <PortalMessage title="Estimate not found" description="This estimate may have been removed." />;
  }

  const attachments = await getAttachmentsForEstimate(business.id, estimate.id);
  const attachmentsWithUrls = await Promise.all(
    attachments.map(async (attachment) => ({
      ...attachment,
      url: await getAttachmentDownloadUrl(attachment.storagePath),
    }))
  );

  return (
    <div className="mx-auto flex min-h-svh max-w-lg flex-col justify-center px-6 py-12">
      <div className="mb-6 flex items-center gap-2">
        <Logo size="md" withWordmark={false} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs text-muted-foreground">Estimate {estimate.estimateNumber}</p>
        <h1 className="mt-1 font-heading text-xl font-semibold text-foreground">{estimate.serviceType}</h1>
        <p className="mt-1 text-sm text-muted-foreground">From {business.businessName}</p>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5">
          <div>
            <dt className="text-xs text-muted-foreground">Estimate value</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{formatCurrency(estimate.estimateValue)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Sent</dt>
            <dd className="mt-0.5 text-sm font-medium text-foreground">{formatDate(estimate.dateSent)}</dd>
          </div>
        </dl>

        {estimate.notes && (
          <div className="mt-5 border-t border-border pt-5">
            <dt className="text-xs text-muted-foreground">Notes</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{estimate.notes}</dd>
          </div>
        )}

        {attachmentsWithUrls.length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <p className="mb-2 text-xs text-muted-foreground">Attachments</p>
            <ul className="flex flex-col gap-1.5">
              {attachmentsWithUrls.map((attachment) => (
                <li key={attachment.id}>
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary hover:underline"
                    >
                      {attachment.fileName}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">{attachment.fileName} (unavailable)</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 border-t border-border pt-5">
          <EstimateResponseActions token={token} status={estimate.status} />
        </div>
      </div>
    </div>
  );
}
