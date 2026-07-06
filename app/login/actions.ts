"use server";

import { randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getBusinessByEmail, bumpSessionTokenVersion } from "@/services/business";
import { hashPassword, verifyPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, createSessionToken, verifySessionToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { logAction } from "@/lib/logger";

// A real scrypt hash we verify against when the account doesn't exist, so the
// "no such user" path does the same work as the "wrong password" path — the
// timing side channel that would otherwise let an attacker enumerate which
// emails have accounts. Computed once per instance against a random secret.
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(32).toString("hex"));

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || "unknown";
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  // Throttle credential stuffing: cap attempts per IP and (separately) per
  // targeted email, so neither a single IP spraying many accounts nor many
  // IPs hammering one account can brute-force unbounded. Best-effort — see
  // lib/rateLimit.ts's serverless caveat.
  const ip = await clientIp();
  const ipLimited = rateLimit(`login:ip:${ip}`, { max: 10, windowMs: 10 * 60 * 1000 }).limited;
  const emailLimited = email
    ? rateLimit(`login:email:${email}`, { max: 5, windowMs: 15 * 60 * 1000 }).limited
    : false;
  if (ipLimited || emailLimited) {
    logAction("auth.login-rate-limited", { ip });
    redirect(`/login?error=rate&from=${encodeURIComponent(from)}`);
  }

  const business = email ? await getBusinessByEmail(email) : null;
  // Always run a verification (dummy hash when there's no account) to keep
  // response time independent of whether the email exists.
  const passwordOk = await verifyPassword(password, business?.passwordHash ?? (await DUMMY_HASH_PROMISE));

  if (!business || !passwordOk) {
    logAction("auth.login-failed", { email });
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    await createSessionToken({ businessId: business.id, email: business.ownerEmail, tokenVersion: business.sessionTokenVersion }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    }
  );

  logAction("auth.login-success", { businessId: business.id });
  redirect(from || "/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  // Bump the server-side token version first so the session is actually
  // revoked everywhere (other devices/copies of the cookie), not just cleared
  // from this browser — deleting the cookie alone can't invalidate a stolen token.
  const existing = await verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (existing) {
    try {
      await bumpSessionTokenVersion(existing.businessId);
    } catch {
      // Best-effort: even if the bump fails, still clear the cookie below.
    }
  }
  cookieStore.delete(SESSION_COOKIE_NAME);
  logAction("auth.logout", {});
  redirect("/login");
}
