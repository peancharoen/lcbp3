'use client';

// File: components/reminder/ReminderHistory.tsx
import { format } from 'date-fns';
import { History, Bell, ShieldAlert, AlertTriangle } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useReminderHistory } from '@/hooks/use-reminder';
import { ReminderType } from '@/types/workflow';

interface ReminderHistoryProps {
  taskPublicId: string;
}

export function ReminderHistoryViewer({ taskPublicId }: ReminderHistoryProps) {
  const { data: history = [], isLoading } = useReminderHistory(taskPublicId);

  const getIcon = (type: ReminderType) => {
    switch (type) {
      case ReminderType.ESCALATION_L1:
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case ReminderType.ESCALATION_L2:
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      default:
        return <Bell className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Reminder History</CardTitle>
        </div>
        <CardDescription>ประวัติการแจ้งเตือนและการยกระดับ</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Loading history...
          </div>
        ) : history.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center border rounded-md border-dashed">
            No reminders sent yet.
          </div>
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <div
                key={item.publicId}
                className="flex items-start gap-3 text-xs border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="mt-0.5">{getIcon(item.reminderType)}</div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold uppercase tracking-wider">
                      {item.reminderType.replace('_', ' ')}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(item.sentAt), 'dd MMM yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Sent to: <span className="text-foreground">{item.user?.fullName ?? 'Unknown User'}</span>
                    {item.escalationLevel > 0 && ` (L${item.escalationLevel})`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
