# TASK-FE-009: Dashboard & Notifications UI

**ID:** TASK-FE-009
**Title:** Dashboard, Notifications & Activity Feed UI
**Category:** Supporting Features
**Priority:** P3 (Low)
**Effort:** 3-4 days
**Dependencies:** TASK-FE-003, TASK-BE-011
**Assigned To:** Frontend Developer

---

## 📋 Overview

Build dashboard homepage with statistics widgets, recent activity, pending approvals, and real-time notifications system.

---

## 🎯 Objectives

1. Create dashboard homepage with widgets
2. Implement statistics cards (documents, pending approvals)
3. Build recent activity feed
4. Create notifications dropdown
5. Add pending tasks section
6. Implement real-time updates (optional)

---

## ✅ Acceptance Criteria

- [ ] Dashboard displays key statistics
- [ ] Recent activity feed working
- [ ] Notifications dropdown functional
- [ ] Pending tasks visible
- [ ] Charts/graphs display data
- [ ] Real-time updates (if WebSocket implemented)

---

## 🔧 Implementation Steps

### Step 1: Dashboard Page

```typescript
// File: src/app/(dashboard)/page.tsx
import { StatsCards } from '@/components/dashboard/stats-cards';
import { RecentActivity } from '@/components/dashboard/recent-activity';
import { PendingTasks } from '@/components/dashboard/pending-tasks';
import { QuickActions } from '@/components/dashboard/quick-actions';

export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome back! Here's what's happening.
        </p>
      </div>

      <QuickActions />
      <StatsCards />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <RecentActivity />
        </div>
        <div className="col-span-1">
          <PendingTasks />
        </div>
      </div>
    </div>
  );
}
```

### Step 2: Statistics Cards

```typescript
// File: src/components/dashboard/stats-cards.tsx
import { Card } from '@/components/ui/card';
import { FileText, Clipboard, CheckCircle, Clock } from 'lucide-react';

export async function StatsCards() {
  const stats = await getStats(); // Fetch from API

  const cards = [
    {
      title: 'Total Correspondences',
      value: stats.correspondences,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Active RFAs',
      value: stats.rfas,
      icon: Clipboard,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Approved Documents',
      value: stats.approved,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Pending Approvals',
      value: stats.pending,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.title} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
```

### Step 3: Recent Activity Feed

```typescript
// File: src/components/dashboard/recent-activity.tsx
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export async function RecentActivity() {
  const activities = await getRecentActivities();

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>

      <div className="space-y-4">
        {activities.map((activity) => (
          <div
            key={activity.id}
            className="flex gap-3 pb-4 border-b last:border-0"
          >
            <Avatar className="h-10 w-10">
              <AvatarFallback>{activity.user.initials}</AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">{activity.user.name}</span>
                <Badge variant="outline" className="text-xs">
                  {activity.action}
                </Badge>
              </div>

              <p className="text-sm text-gray-600">{activity.description}</p>

              <p className="text-xs text-gray-500 mt-1">
                {formatDistanceToNow(new Date(activity.createdAt), {
                  addSuffix: true,
                })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

### Step 4: Notifications Dropdown

```typescript
// File: src/components/layout/notifications-dropdown.tsx
'use client';

import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { notificationApi } from '@/lib/api/notifications';

export function NotificationsDropdown() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // Fetch notifications
    notificationApi.getUnread().then((data) => {
      setNotifications(data.items);
      setUnreadCount(data.unreadCount);
    });
  }, []);

  const markAsRead = async (id: number) => {
    await notificationApi.markAsRead(id);
    setNotifications((prev) => prev.filter((n) => n.notification_id !== id));
    setUnreadCount((prev) => prev - 1);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
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

        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No new notifications
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.notification_id}
                className="flex flex-col items-start p-3 cursor-pointer"
                onClick={() => markAsRead(notification.notification_id)}
              >
                <div className="font-medium text-sm">{notification.title}</div>
                <div className="text-xs text-gray-600 mt-1">
                  {notification.message}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(notification.created_at), {
                    addSuffix: true,
                  })}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-center justify-center">
          View All
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Step 5: Pending Tasks Widget

```typescript
// File: src/components/dashboard/pending-tasks.tsx
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export async function PendingTasks() {
  const tasks = await getPendingTasks();

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Pending Tasks</h3>

      <div className="space-y-3">
        {tasks.map((task) => (
          <Link
            key={task.id}
            href={task.url}
            className="block p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-sm font-medium">{task.title}</span>
              <Badge variant="warning" className="text-xs">
                {task.daysOverdue > 0 ? `${task.daysOverdue}d overdue` : 'Due'}
              </Badge>
            </div>
            <p className="text-xs text-gray-600">{task.description}</p>
          </Link>
        ))}
      </div>
    </Card>
  );
}
```

---

## 📦 Deliverables

- [ ] Dashboard page with widgets
- [ ] Statistics cards
- [ ] Recent activity feed
- [ ] Notifications dropdown
- [ ] Pending tasks section
- [ ] Quick actions buttons

---

## 🔗 Related Documents

- [TASK-BE-011: Notification & Audit](./TASK-BE-011-notification-audit.md)

---

**Created:** 2025-12-01
**Status:** Ready
