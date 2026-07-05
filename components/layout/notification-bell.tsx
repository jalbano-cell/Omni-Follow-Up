"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { markNotificationReadAction, markAllNotificationsReadAction } from "@/app/notifications/actions";
import { formatDate } from "@/lib/date";
import type { Notification } from "@/types";

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
    });
  }

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`} className="relative" />
        }
      >
        <Bell className="size-4.5" strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex items-center justify-between px-1.5 py-1">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">No notifications yet.</p>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex-col items-start gap-0.5 py-2"
              render={<Link href={notification.leadId ? `/leads/${notification.leadId}` : "/leads"} />}
              onClick={() => !notification.isRead && markRead(notification.id)}
            >
              <div className="flex w-full items-center gap-1.5">
                {!notification.isRead && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                <span className="truncate text-foreground">{notification.message}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(notification.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
