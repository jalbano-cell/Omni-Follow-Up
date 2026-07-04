"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getBusinessByEmail } from "@/services/business";
import { verifyPassword } from "@/lib/password";
import { SESSION_COOKIE_NAME, createSessionToken } from "@/lib/auth";
import { logAction } from "@/lib/logger";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/");

  const business = email ? await getBusinessByEmail(email) : null;
  const passwordOk = business ? await verifyPassword(password, business.passwordHash) : false;

  if (!business || !passwordOk) {
    logAction("auth.login-failed", { email });
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, await createSessionToken({ businessId: business.id, email: business.ownerEmail }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  logAction("auth.login-success", { businessId: business.id });
  redirect(from || "/");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  logAction("auth.logout", {});
  redirect("/login");
}
