"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PendingTask } from "@/types/dashboard";
import { AlertCircle, ArrowRight } from "lucide-react";

interface PendingTasksProps {
  tasks: PendingTask[];
}

export function PendingTasks({ tasks }: PendingTasksProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Pending Tasks
          {tasks.length > 0 && (
            <Badge variant="destructive" className="rounded-full h-5 w-5 p-0 flex items-center justify-center text-[10px]">
              {tasks.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No pending tasks. Good job!
            </p>
          ) : (
            tasks.map((task) => (
              <Link
                key={task.id}
                href={task.url}
                className="block p-3 bg-muted/40 rounded-lg border hover:bg-muted/60 transition-colors group"
              >
                <div className="flex items-start justify-between mb-1">
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    {task.title}
                  </span>
                  {task.daysOverdue > 0 ? (
                    <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
                      {task.daysOverdue}d overdue
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-yellow-50 text-yellow-700 border-yellow-200">
                      Due Soon
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
                  {task.description}
                </p>
                <div className="flex items-center text-xs text-primary font-medium">
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
