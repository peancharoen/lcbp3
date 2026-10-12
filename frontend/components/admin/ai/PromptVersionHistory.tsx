// File: frontend/components/admin/ai/PromptVersionHistory.tsx
// Change Log
// - 2026-05-25: Created PromptVersionHistory component (ADR-029)

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Trash2, BookOpen, Clock, StickyNote } from 'lucide-react';
import { AiPrompt } from '@/types/ai-prompts';
import { cn } from '@/lib/utils';

interface PromptVersionHistoryProps {
  versions: AiPrompt[];
  isLoading: boolean;
  onLoadTemplate: (version: AiPrompt) => void;
  onActivateVersion: (versionNumber: number) => void;
  onDeleteVersion: (versionNumber: number) => void;
  isActivating: boolean;
  isDeleting: boolean;
}

/**
 * แผงประวัติและเวอร์ชันของ AI Prompts ทางฝั่งขวามือ
 * แสดงรายการเวอร์ชันพร้อมปุ่มเรียกใช้ เปิดทำงาน หรือลบทิ้ง
 */
export default function PromptVersionHistory({
  versions,
  isLoading,
  onLoadTemplate,
  onActivateVersion,
  onDeleteVersion,
  isActivating,
  isDeleting,
}: PromptVersionHistoryProps) {
  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center text-sm text-muted-foreground">
        <Clock className="mr-2 h-4 w-4 animate-spin text-primary" />
        กำลังโหลดประวัติเวอร์ชัน...
      </div>
    );
  }
  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="border-b border-border/10 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <BookOpen className="h-4 w-4 animate-pulse text-primary" />
          ประวัติเวอร์ชัน (Version History)
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[600px] space-y-3 overflow-y-auto px-3 pt-4 sm:px-4">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs italic text-muted-foreground">
            ไม่พบเวอร์ชันอื่นในระบบ
          </div>
        ) : (
          versions.map((version) => {
            const isActive = version.isActive === true || (version.isActive as unknown) === 1;
            return (
              <div
                key={version.versionNumber}
                className={cn(
                  'group relative rounded-lg border border-border/30 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/30 hover:bg-background/80',
                  isActive && 'border-success/20 bg-success/[0.02] shadow-[inset_0_1px_3px_rgba(16,185,129,0.03)]'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">v{version.versionNumber}</span>
                      {isActive ? (
                        <Badge className="flex select-none items-center gap-1 border-success/20 bg-success/10 px-1.5 py-0 text-[10px] text-success hover:bg-success/20">
                          <CheckCircle2 className="h-3 w-3" />
                          ใช้งานจริง (Active)
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="select-none border-border/50 bg-background/40 text-[10px] text-muted-foreground"
                        >
                          ร่าง (Inactive)
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        สร้าง: {new Date(version.createdAt).toLocaleString('th-TH')}
                      </span>
                      {version.lastTestedAt && (
                        <span className="flex items-center gap-1 text-success/90">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          ทดสอบแล้ว: {new Date(version.lastTestedAt).toLocaleString('th-TH')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-90 transition-opacity duration-200 group-hover:opacity-100 sm:opacity-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-muted-foreground hover:bg-secondary"
                      onClick={() => onLoadTemplate(version)}
                    >
                      โหลด (Load)
                    </Button>
                    {!version.isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActivating}
                          className="h-7 text-[10px] text-success hover:bg-success/10 hover:text-success"
                          onClick={() => onActivateVersion(version.versionNumber)}
                        >
                          ใช้งาน (Activate)
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isDeleting}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => onDeleteVersion(version.versionNumber)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {version.manualNote && (
                  <div className="mt-2.5 flex select-text items-start gap-1.5 rounded border border-border/10 bg-muted/30 p-2 text-[11px] text-muted-foreground">
                    <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <p className="whitespace-pre-wrap leading-relaxed">{version.manualNote}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
