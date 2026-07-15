import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Toaster } from "@/components/ui/sonner";
import { getNotifications } from "@/services/db";
import { getBusinessById } from "@/services/business";
import { getOptionalSession } from "@/lib/session";
import type { WorkspaceProductMode } from "@/types";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Omni Follow Up",
  description: "Estimate follow-up automation for local service businesses.",
};

/**
 * Renders on every route, including public ones (login/signup) where there's
 * no session — getOptionalSession (unlike getCurrentSession) returns null
 * instead of redirecting there. Also swallows database errors so a
 * misconfigured/unreachable base degrades to "no bell," not a broken layout.
 */
async function NotificationBellSlot() {
  const session = await getOptionalSession();
  if (!session) return null;

  try {
    // One read, not two: unreadCount is derived from the same list the bell
    // already loads (this used to fire getUnreadNotificationCount and
    // getNotifications in parallel — two full-table reads per page render).
    const allNotifications = await getNotifications(session.businessId);
    const unreadCount = allNotifications.reduce((n, notification) => n + (notification.isRead ? 0 : 1), 0);
    return <NotificationBell notifications={allNotifications.slice(0, 8)} unreadCount={unreadCount} />;
  } catch {
    return null;
  }
}

/**
 * Same "renders on every route, degrade to null" posture as NotificationBellSlot —
 * the sidebar/mobile nav need to know which product surfaces this business
 * can use (services/business.ts's productMode) to hide the Estimates/Follow-up
 * Queue/Replies/Analytics or Appointments nav entries accordingly.
 */
async function getNavProductMode(): Promise<WorkspaceProductMode | null> {
  const session = await getOptionalSession();
  if (!session) return null;
  try {
    const business = await getBusinessById(session.businessId);
    return business?.productMode ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const productMode = await getNavProductMode();

  return (
    <html
      lang="en"
      className={`dark ${spaceGrotesk.variable} ${inter.variable} h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full font-[family-name:var(--font-sans)]">
        <AppShell productMode={productMode} notificationBell={<NotificationBellSlot />}>
          {children}
        </AppShell>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
