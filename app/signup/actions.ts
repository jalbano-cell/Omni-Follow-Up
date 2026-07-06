"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createBusiness, getBusinessByEmail } from "@/services/business";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { logAction } from "@/lib/logger";

// A small blocklist of the passwords credential-stuffing lists lead with. Not
// a substitute for a real breached-password check (e.g. HaveIBeenPwned's
// k-anonymity range API), but it cheaply rejects the worst offenders.
const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "12345678", "123456789", "1234567890",
  "qwerty123", "letmein1", "iloveyou", "admin123", "welcome1", "changeme1",
]);

function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include both letters and numbers.";
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return "That password is too common — choose something harder to guess.";
  return null;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return (forwarded ? forwarded.split(",")[0] : h.get("x-real-ip"))?.trim() || "unknown";
}

export async function signupAction(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  // Cap account creation per IP so signup can't be scripted into an abuse /
  // resource-exhaustion vector (each new business can trigger Gmail scanning).
  const ip = await clientIp();
  if (rateLimit(`signup:ip:${ip}`, { max: 5, windowMs: 60 * 60 * 1000 }).limited) {
    logAction("auth.signup-rate-limited", { ip });
    redirect(`/signup?error=${encodeURIComponent("Too many signups from this network. Please try again later.")}`);
  }

  if (!businessName || !ownerName || !ownerEmail || !password) {
    redirect(`/signup?error=${encodeURIComponent("All fields are required.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent("Passwords don't match.")}`);
  }
  const pwProblem = passwordProblem(password);
  if (pwProblem) {
    redirect(`/signup?error=${encodeURIComponent(pwProblem)}`);
  }

  const existing = await getBusinessByEmail(ownerEmail);
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);
  const business = await createBusiness({ businessName, ownerName, ownerEmail, passwordHash });
  logAction("auth.signup", { businessId: business.id });

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

  redirect("/onboarding/gmail");
}
