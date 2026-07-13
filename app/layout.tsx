import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import { NotificationBell } from "@/components/layout/notification-bell";
import { Toaster } from "@/components/ui/sonner";
import { getNotifications, getUnreadNotificationCount } from "@/services/db";
import { getOptionalSession } from "@/lib/session";
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
    const [unreadCount, allNotifications] = await Promise.all([
      getUnreadNotificationCount(session.businessId),
      getNotifications(session.businessId),
    ]);
    return <NotificationBell notifications={allNotifications.slice(0, 8)} unreadCount={unreadCount} />;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        <AppShell notificationBell={<NotificationBellSlot />}>{children}</AppShell>
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
