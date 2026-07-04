import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import type { SessionPayload } from "@/types";

/**
 * Resolves the current business's identity for Server Components/Actions.
 * Independently re-verifies the JWT from the cookie rather than trusting
 * middleware-forwarded headers — cheap (one HMAC check) and removes an
 * entire class of "did middleware forward this on every path" bugs.
 *
 * Middleware already blocks unauthenticated requests from reaching here;
 * the redirect below is a defensive fallback, not the primary auth gate.
 */
export async function getCurrentSession(): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function getCurrentBusinessId(): Promise<string> {
  const { businessId } = await getCurrentSession();
  return businessId;
}
