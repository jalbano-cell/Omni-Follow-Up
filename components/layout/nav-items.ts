import { LayoutDashboard, FileText, Clock, MailOpen, MessageSquarePlus, CalendarCheck, BarChart3, Settings, type LucideIcon } from "lucide-react";
import type { WorkspaceProductMode } from "@/types";

/**
 * Shared between components/layout/sidebar.tsx and mobile-nav.tsx (previously
 * two independent copies of this same list) — pulled out into one place once
 * entries needed a `surface` tag for per-workspace product-mode filtering
 * (see isNavItemVisible below), so the desktop and mobile nav can't drift.
 */
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Which product surface this nav entry belongs to — omitted means always shown (Dashboard, Leads, Settings; Leads are never gated by productMode, see CLAUDE.md's Appointments section). */
  surface?: "estimates" | "appointments";
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: MessageSquarePlus },
  { href: "/appointments", label: "Appointments", icon: CalendarCheck, surface: "appointments" },
  { href: "/estimates", label: "Estimates", icon: FileText, surface: "estimates" },
  { href: "/follow-ups", label: "Follow-up Queue", icon: Clock, surface: "estimates" },
  { href: "/replies", label: "Reply Inbox", icon: MailOpen, surface: "estimates" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, surface: "estimates" },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Fails open (shows the item) for "both", null/undefined productMode — same fail-open posture as the DB default. */
export function isNavItemVisible(surface: NavItem["surface"], productMode: WorkspaceProductMode | null | undefined): boolean {
  if (!surface) return true;
  if (productMode === "estimates_only") return surface === "estimates";
  if (productMode === "appointments_only") return surface === "appointments";
  return true;
}
