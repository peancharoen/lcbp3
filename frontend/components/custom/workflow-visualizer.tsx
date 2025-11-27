// File: components/custom/workflow-visualizer.tsx

import React from "react";
import { Check, Clock, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * สถานะของขั้นตอนใน Workflow
 */
export type StepStatus = "completed" | "current" | "pending" | "rejected" | "skipped";

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
    <div className={cn("w-full overflow-x-auto py-4 px-2", className)}>
      <div className="flex items-start min-w-max">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          
          // กำหนดสีตามสถานะ
          let statusColor = "bg-muted text-muted-foreground border-muted"; // pending
          let icon = <span className="text-xs">{index + 1}</span>;
          let lineColor = "bg-muted";

          switch (step.status) {
            case "completed":
              statusColor = "bg-green-600 text-white border-green-600";
              icon = <Check className="w-4 h-4" />;
              lineColor = "bg-green-600";
              break;
            case "current":
              statusColor = "bg-blue-600 text-white border-blue-600 ring-4 ring-blue-100";
              icon = <Clock className="w-4 h-4 animate-pulse" />;
              lineColor = "bg-muted"; // เส้นต่อไปยังเป็นสีเทา
              break;
            case "rejected":
              statusColor = "bg-destructive text-destructive-foreground border-destructive";
              icon = <XCircle className="w-4 h-4" />;
              lineColor = "bg-destructive";
              break;
            case "skipped":
                statusColor = "bg-orange-400 text-white border-orange-400";
                icon = <AlertCircle className="w-4 h-4" />;
                lineColor = "bg-orange-400";
                break;
            case "pending":
            default:
              // ใช้ default
              break;
          }

          return (
            <div key={step.id} className="relative flex flex-col items-center flex-1 group">
              {/* Connector Line (Left & Right) */}
              <div className="flex items-center w-full absolute top-4 left-0 -z-10">
                 {/* Left Half Line (Previous step connection) */}
                 <div className={cn("h-1 w-1/2", index === 0 ? "bg-transparent" : (steps[index-1].status === 'completed' || steps[index-1].status === 'skipped' ? lineColor : (steps[index].status === 'completed' ? lineColor : 'bg-muted')))} />
                 
                 {/* Right Half Line (Next step connection) */}
                 <div className={cn("h-1 w-1/2", isLast ? "bg-transparent" : (step.status === 'completed' || step.status === 'skipped' ? lineColor : 'bg-muted'))} />
              </div>

              {/* Step Circle */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all duration-300",
                  statusColor
                )}
              >
                {icon}
              </div>

              {/* Step Label */}
              <div className="mt-3 text-center space-y-1 max-w-[120px]">
                <p className={cn("text-sm font-semibold", step.status === 'current' ? 'text-blue-700' : 'text-foreground')}>
                    {step.label}
                </p>
                {step.subLabel && (
                  <p className="text-xs text-muted-foreground truncate" title={step.subLabel}>
                    {step.subLabel}
                  </p>
                )}
                {step.date && (
                  <p className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full inline-block">
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