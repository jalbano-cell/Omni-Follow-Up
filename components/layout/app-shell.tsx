"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Logo } from "@/components/layout/logo";
import type { WorkspaceProductMode } from "@/types";

export function AppShell({
  children,
  notificationBell,
  productMode,
}: {
  children: React.ReactNode;
  notificationBell?: React.ReactNode;
  /** Which nav entries to show — see components/layout/sidebar.tsx/mobile-nav.tsx. Null on public/unauthenticated routes (they never reach this point anyway). */
  productMode?: WorkspaceProductMode | null;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The login/signup/onboarding screens, the public customer portal
  // (/e/[token] — no session, a customer viewing their own estimate), the
  // team/workspace invite-claim page (/invite/[token] — no session yet
  // either), and the account-paused lockout page (a session exists but
  // shouldn't see nav links to pages it's locked out of) all render their
  // own full-page layout — no sidebar/nav chrome meant for a logged-in,
  // active business owner.
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/account-paused" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/e/") ||
    pathname.startsWith("/invite/")
  ) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-svh w-full">
      <Sidebar productMode={productMode} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              }
            />
            <SheetContent side="left" className="w-64 p-0">
              <MobileNav onNavigate={() => setOpen(false)} productMode={productMode} />
            </SheetContent>
          </Sheet>
          <Link href="/">
            <Logo />
          </Link>
          <div className="ml-auto">{notificationBell}</div>
        </header>

        <header className="hidden h-14 items-center justify-end border-b border-border px-6 md:flex">
          {notificationBell}
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1200px] px-6 py-8 md:px-10 md:py-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
