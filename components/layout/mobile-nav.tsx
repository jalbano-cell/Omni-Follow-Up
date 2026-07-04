"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, Clock, MailOpen, BarChart3, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/login/actions";
import { Logo } from "@/components/layout/logo";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/estimates", label: "Estimates", icon: FileText },
  { href: "/follow-ups", label: "Follow-up Queue", icon: Clock },
  { href: "/replies", label: "Reply Inbox", icon: MailOpen },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center px-6">
        <Logo />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-foreground/70 hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon className="size-4" strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-3 py-3">
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-foreground/70 transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <LogOut className="size-4" strokeWidth={2} />
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}
