'use client';

// File: components/review-task/ReviewTaskInbox.tsx
// Review Task inbox พร้อม aggregate status indicator (T071)
import React, { useState } from 'react';
import { Clock, CheckCircle2, AlertTriangle, ArrowRightLeft, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { DelegatedBadge } from '@/components/review-task/DelegatedBadge';

type ReviewTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELEGATED' | 'EXPIRED' | 'CANCELLED';

interface ReviewTaskItem {
  publicId: string;
  status: ReviewTaskStatus;
  discipline?: { name: string };
  assignedToUser?: { publicId: string; fullName?: string; email?: string };
  delegatedFromUser?: { publicId: string; fullName?: string; email?: string };
  dueDate?: string;
  rfaNumber?: string;
  documentTitle?: string;
}

interface AggregateStatus {
  total: number;
  completed: number;
  pending: number;
  completionPct: number;
  isAllComplete: boolean;
  hasExpired: boolean;
}

interface ReviewTaskInboxProps {
  tasks: ReviewTaskItem[];
  aggregateStatus?: AggregateStatus;
  onStartTask: (taskPublicId: string) => void;
  onCompleteTask: (taskPublicId: string) => void;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<ReviewTaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pending', variant: 'outline' },
  IN_PROGRESS: { label: 'In Progress', variant: 'secondary' },
  COMPLETED: { label: 'Completed', variant: 'default' },
  DELEGATED: { label: 'Delegated', variant: 'secondary' },
  EXPIRED: { label: 'Expired', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'outline' },
};

export function ReviewTaskInbox({
  tasks,
  aggregateStatus,
  onStartTask,
  onCompleteTask,
  isLoading,
}: ReviewTaskInboxProps) {
  const [filter, setFilter] = useState<ReviewTaskStatus | 'ALL'>('ALL');

  const filtered = filter === 'ALL' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-4">
      {aggregateStatus && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Parallel Review Progress
              </CardTitle>
              <span className="text-sm font-semibold">{aggregateStatus.completionPct}%</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            <Progress value={aggregateStatus.completionPct} className="h-2" />
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{aggregateStatus.completed}/{aggregateStatus.total} tasks complete</span>
              {aggregateStatus.isAllComplete && (
                <Badge variant="default" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> All Complete
                </Badge>
              )}
              {aggregateStatus.hasExpired && (
                <Badge variant="destructive" className="text-xs gap-1">
                  <AlertTriangle className="h-3 w-3" /> Has Expired
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map((s) => (
          <Button
            key={s}
            variant={filter === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(s)}
          >
            {s === 'ALL' ? 'All' : STATUS_CONFIG[s]?.label ?? s}
          </Button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((task) => {
          const config = STATUS_CONFIG[task.status];
          const isOverdue =
            task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED';

          return (
            <Card key={task.publicId} className={isOverdue ? 'border-destructive/50' : ''}>
              <CardContent className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{task.rfaNumber ?? task.publicId}</span>
                      <Badge variant={config.variant} className="text-xs">{config.label}</Badge>
                      {task.delegatedFromUser && (
                        <DelegatedBadge delegatedFromUser={task.delegatedFromUser} />
                      )}
                      {isOverdue && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </Badge>
                      )}
                    </div>
                    {task.documentTitle && (
                      <p className="text-xs text-muted-foreground truncate">{task.documentTitle}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {task.discipline && <span>{task.discipline.name}</span>}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(task.dueDate).toLocaleDateString('th-TH')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.status === 'PENDING' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStartTask(task.publicId)}
                        disabled={isLoading}
                      >
                        Start
                      </Button>
                    )}
                    {task.status === 'IN_PROGRESS' && (
                      <Button
                        size="sm"
                        onClick={() => onCompleteTask(task.publicId)}
                        disabled={isLoading}
                      >
                        Complete
                      </Button>
                    )}
                    {task.status === 'COMPLETED' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {task.status === 'DELEGATED' && (
                      <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            No review tasks found.
          </div>
        )}
      </div>
    </div>
  );
}
