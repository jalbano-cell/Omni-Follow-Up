"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createBusiness, getBusinessByEmail } from "@/services/business";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { logAction } from "@/lib/logger";

export async function signupAction(formData: FormData) {
  const businessName = String(formData.get("businessName") ?? "").trim();
  const ownerName = String(formData.get("ownerName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!businessName || !ownerName || !ownerEmail || !password) {
    redirect(`/signup?error=${encodeURIComponent("All fields are required.")}`);
  }
  if (password !== confirmPassword) {
    redirect(`/signup?error=${encodeURIComponent("Passwords don't match.")}`);
  }
  if (password.length < 8) {
    redirect(`/signup?error=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  const existing = await getBusinessByEmail(ownerEmail);
  if (existing) {
    redirect(`/signup?error=${encodeURIComponent("An account with that email already exists.")}`);
  }

  const passwordHash = await hashPassword(password);
  const business = await createBusiness({ businessName, ownerName, ownerEmail, passwordHash });
  logAction("auth.signup", { businessId: business.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken({ businessId: business.id, email: business.ownerEmail }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect("/onboarding/industry");
}
