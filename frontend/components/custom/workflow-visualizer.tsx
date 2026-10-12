// File: components/custom/workflow-visualizer.tsx

import React from 'react';
import { Check, Clock, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * สถานะของขั้นตอนใน Workflow
 */
export type StepStatus = 'completed' | 'current' | 'pending' | 'rejected' | 'skipped';

export interface WorkflowStep {
  id: string | number;
  label: string;
  subLabel?: string; // เช่น ชื่อองค์กร หรือ ชื่อผู้อนุมัติ
  status: StepStatus;
  date?: string; // วันที่ดำเนินการ (ถ้ามี)
}

interface WorkflowVisualizerProps {
  steps: WorkflowStep[];
  className?: string;
}

/**
 * WorkflowVisualizer Component
 * แสดงเส้นเวลา (Timeline) ของกระบวนการอนุมัติแบบแนวนอน
 */
export function WorkflowVisualizer({ steps, className }: WorkflowVisualizerProps) {
  return (
    <div className={cn('w-full overflow-x-auto px-2 py-4', className)}>
      <div className="flex min-w-max items-start">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          // กำหนดสีตามสถานะ
          let statusColor = 'bg-muted text-muted-foreground border-muted'; // pending
          let icon = <span className="text-xs">{index + 1}</span>;
          let lineColor = 'bg-muted';

          switch (step.status) {
            case 'completed':
              statusColor = 'bg-success text-white border-success';
              icon = <Check className="h-4 w-4" />;
              lineColor = 'bg-success';
              break;
            case 'current':
              statusColor = 'bg-info text-white border-info ring-4 ring-info/20';
              icon = <Clock className="h-4 w-4 animate-pulse" />;
              lineColor = 'bg-muted'; // เส้นต่อไปยังเป็นสีเทา
              break;
            case 'rejected':
              statusColor = 'bg-destructive text-destructive-foreground border-destructive';
              icon = <XCircle className="h-4 w-4" />;
              lineColor = 'bg-destructive';
              break;
            case 'skipped':
              statusColor = 'bg-caution/30 text-white border-caution';
              icon = <AlertCircle className="h-4 w-4" />;
              lineColor = 'bg-caution/30';
              break;
            case 'pending':
            default:
              // ใช้ default
              break;
          }

          return (
            <div key={step.id} className="group relative flex flex-1 flex-col items-center">
              {/* Connector Line (Left & Right) */}
              <div className="absolute left-0 top-4 -z-10 flex w-full items-center">
                {/* Left Half Line (Previous step connection) */}
                <div
                  className={cn(
                    'h-1 w-1/2',
                    index === 0
                      ? 'bg-transparent'
                      : steps[index - 1].status === 'completed' || steps[index - 1].status === 'skipped'
                        ? lineColor
                        : steps[index].status === 'completed'
                          ? lineColor
                          : 'bg-muted'
                  )}
                />

                {/* Right Half Line (Next step connection) */}
                <div
                  className={cn(
                    'h-1 w-1/2',
                    isLast
                      ? 'bg-transparent'
                      : step.status === 'completed' || step.status === 'skipped'
                        ? lineColor
                        : 'bg-muted'
                  )}
                />
              </div>

              {/* Step Circle */}
              <div
                className={cn(
                  'z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300',
                  statusColor
                )}
              >
                {icon}
              </div>

              {/* Step Label */}
              <div className="mt-3 max-w-[120px] space-y-1 text-center">
                <p className={cn('text-sm font-semibold', step.status === 'current' ? 'text-info' : 'text-foreground')}>
                  {step.label}
                </p>
                {step.subLabel && (
                  <p className="truncate text-xs text-muted-foreground" title={step.subLabel}>
                    {step.subLabel}
                  </p>
                )}
                {step.date && (
                  <p className="inline-block rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {step.date}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
