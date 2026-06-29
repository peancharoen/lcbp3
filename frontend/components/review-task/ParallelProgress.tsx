'use client';

// File: components/review-task/ParallelProgress.tsx
// Parallel review progress indicator แสดงทุก discipline tracks (T072)
import React from 'react';
import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DELEGATED' | 'EXPIRED' | 'CANCELLED';

interface DisciplineTrack {
  disciplineId: string;
  disciplineName: string;
  taskStatus: TaskStatus;
  responseCode?: string;
  dueDate?: string;
  assigneeName?: string;
}

interface ParallelProgressProps {
  tracks: DisciplineTrack[];
  overallPct: number;
  isAllComplete: boolean;
}

const TRACK_ICON: Record<TaskStatus, React.ElementType> = {
  PENDING: Clock,
  IN_PROGRESS: Clock,
  COMPLETED: CheckCircle2,
  DELEGATED: Clock,
  EXPIRED: AlertTriangle,
  CANCELLED: AlertTriangle,
};

const TRACK_COLOR: Record<TaskStatus, string> = {
  PENDING: 'text-muted-foreground',
  IN_PROGRESS: 'text-blue-500',
  COMPLETED: 'text-green-500',
  DELEGATED: 'text-amber-500',
  EXPIRED: 'text-destructive',
  CANCELLED: 'text-muted-foreground',
};

export function ParallelProgress({ tracks, overallPct, isAllComplete }: ParallelProgressProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Parallel Review Tracks</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{overallPct}%</span>
          {isAllComplete && (
            <Badge variant="default" className="text-xs">All Complete</Badge>
          )}
        </div>
      </div>
      <Progress value={overallPct} className="h-1.5" />

      <div className="space-y-1.5">
        {tracks.map((track) => {
          const Icon = TRACK_ICON[track.taskStatus];
          const colorClass = TRACK_COLOR[track.taskStatus];

          return (
            <div
              key={track.disciplineId}
              className="flex items-center justify-between py-1.5 px-2 rounded bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${colorClass} flex-shrink-0`} />
                <div>
                  <p className="text-sm font-medium">{track.disciplineName}</p>
                  {track.assigneeName && (
                    <p className="text-xs text-muted-foreground">{track.assigneeName}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {track.responseCode && (
                  <span className="font-mono font-bold text-foreground">{track.responseCode}</span>
                )}
                {track.dueDate && (
                  <span>{new Date(track.dueDate).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
