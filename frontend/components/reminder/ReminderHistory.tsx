'use client';

// File: components/reminder/ReminderHistory.tsx
// แสดงประวัติ Reminder และ Escalation ของ Review Task (T050)
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertTriangle, Bell } from 'lucide-react';

type ReminderType = 'DUE_SOON' | 'ON_DUE' | 'OVERDUE' | 'ESCALATION_L1' | 'ESCALATION_L2';

interface ReminderEntry {
  id: string;
  type: ReminderType;
  sentAt: string;
  recipient?: string;
  isDelivered?: boolean;
}

interface ReminderHistoryProps {
  reminders: ReminderEntry[];
  isLoading?: boolean;
}

const TYPE_CONFIG: Record<
  ReminderType,
  { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  DUE_SOON: { label: 'Due Soon', icon: Clock, variant: 'outline' },
  ON_DUE: { label: 'Due Today', icon: Bell, variant: 'secondary' },
  OVERDUE: { label: 'Overdue', icon: AlertTriangle, variant: 'destructive' },
  ESCALATION_L1: { label: 'Escalation L1', icon: AlertTriangle, variant: 'destructive' },
  ESCALATION_L2: { label: 'Escalation L2 (PM)', icon: AlertTriangle, variant: 'destructive' },
};

export function ReminderHistory({ reminders, isLoading }: ReminderHistoryProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading reminder history...</div>;
  }

  if (reminders.length === 0) {
    return <div className="text-sm text-muted-foreground">No reminders sent yet.</div>;
  }

  return (
    <div className="space-y-2">
      {reminders.map((entry) => {
        const config = TYPE_CONFIG[entry.type];
        const Icon = config.icon;

        return (
          <div
            key={entry.id}
            className="flex items-center justify-between py-1.5 border-b last:border-0"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <Badge variant={config.variant} className="text-xs">
                {config.label}
              </Badge>
              {entry.recipient && (
                <span className="text-xs text-muted-foreground">→ {entry.recipient}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {entry.isDelivered !== undefined && (
                <span className={`text-xs ${entry.isDelivered ? 'text-green-600' : 'text-orange-500'}`}>
                  {entry.isDelivered ? '✓ Delivered' : '⏳ Pending'}
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {new Date(entry.sentAt).toLocaleDateString('th-TH', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
