"use client";

import { Bell, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useNotifications, useMarkNotificationRead } from "@/hooks/use-notification";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

export function NotificationsDropdown() {
  const router = useRouter();
  const { data, isLoading } = useNotifications();
  const markAsRead = useMarkNotificationRead();

  const notifications = data?.items || [];
  const unreadCount = data?.unreadCount || 0;

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead.mutate(notification.notification_id);
    }
    if (notification.link) {
      router.push(notification.link);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && !isLoading && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {isLoading ? (
             <div className="flex justify-center p-4">
                 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
             </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.slice(0, 5).map((notification: any) => (
              <DropdownMenuItem
                key={notification.notification_id}
                className={`flex flex-col items-start p-3 cursor-pointer ${
                    !notification.is_read ? 'bg-muted/30' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex justify-between w-full">
                     <span className="font-medium text-sm">{notification.title}</span>
                     {!notification.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 mt-1" />}
                </div>
                <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {notification.message}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 self-end">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center justify-center text-xs text-muted-foreground" disabled>
          View All Notifications (Coming Soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
