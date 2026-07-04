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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // The login/signup/onboarding screens render their own full-page layout —
  // no sidebar/nav chrome that would just redirect back to /login anyway.
  if (pathname === "/login" || pathname === "/signup" || pathname.startsWith("/onboarding")) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-svh w-full">
      <Sidebar />

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
              <MobileNav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Link href="/">
            <Logo />
          </Link>
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
