'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { PendingTask } from '@/types/dashboard';
import { ArrowRight } from 'lucide-react';

interface PendingTasksProps {
  tasks: PendingTask[] | undefined;
  isLoading: boolean;
}

export function PendingTasks({ tasks, isLoading }: PendingTasksProps) {
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg">Pending Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!tasks) tasks = [];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          Pending Tasks
          {tasks.length > 0 && (
            <Badge
              variant="destructive"
              className="flex h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {tasks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No pending tasks. Good job!</p>
          ) : (
            tasks.map((task) => (
              <Link
                key={task.publicId}
                href={task.url}
                className="group block rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted/60"
              >
                <div className="mb-1 flex items-start justify-between">
                  <span className="text-sm font-medium transition-colors group-hover:text-primary">{task.title}</span>
                  {task.daysOverdue > 0 ? (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                      {task.daysOverdue}d overdue
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-5 border-warning/30 bg-warning/10 px-1.5 text-[10px] text-warning"
                    >
                      Due Soon
                    </Badge>
                  )}
                </div>
                <p className="mb-2 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>
                <div className="flex items-center text-xs font-medium text-primary">
                  View Details <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </Link>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
