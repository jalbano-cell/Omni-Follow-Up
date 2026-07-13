import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/auth";
import { suppressContact } from "@/services/suppression";
import { logAction } from "@/lib/logger";

/**
 * One-click CASL unsubscribe — the link embedded in every appointment-
 * lifecycle automated email (services/emailTemplates/complianceFooter.ts).
 * A GET (not a form submit) so a plain click from an email client is enough.
 * Always redirects to the static /unsubscribed page rather than returning
 * JSON, since this is only ever opened in a browser.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = await verifyUnsubscribeToken(token);

  if (!payload) {
    return NextResponse.redirect(new URL("/unsubscribed?ok=0", request.url));
  }

  try {
    await suppressContact(payload.businessId, payload.email, "unsubscribe link");
  } catch (error) {
    logAction("unsubscribe.suppress-failed", {
      businessId: payload.businessId,
      error: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.redirect(new URL("/unsubscribed?ok=0", request.url));
  }

  return NextResponse.redirect(new URL("/unsubscribed?ok=1", request.url));
}
