// File: frontend/components/admin/ai/VersionHistory.tsx
// Change Log:
// - 2026-06-14: Created VersionHistory component with type filtering and nice badges (conforming to task T017)
// - 2026-06-15: Added All Types view grouped by prompt type (T065)
// - 2026-06-15: Added pagination (20 versions/page) (T075)
// - 2026-06-15: เปลี่ยน button pagination เป็น infinite scroll ตาม spec FR (T075)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Trash2, BookOpen, Clock, StickyNote, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PromptVersion } from '@/lib/types/ai-prompts';
import { cn } from '@/lib/utils';

interface VersionHistoryProps {
  versions: PromptVersion[];
  isLoading: boolean;
  onLoadTemplate: (version: PromptVersion) => void;
  onActivateVersion: (versionNumber: number) => void;
  onDeleteVersion: (versionNumber: number) => void;
  isActivating: boolean;
  isDeleting: boolean;
  showAllTypes?: boolean;
}

/**
 * คอมโพเนนต์แสดงประวัติเวอร์ชันของพรอมต์ตามประเภทที่กรองไว้
 * หรือแสดงทุกประเภทแบบจัดกลุ่ม (T065)
 * แสดงรายการเวอร์ชันพร้อมปุ่มพรีโหลด เปิดใช้งาน และลบเวอร์ชันที่ไม่ต้องการ
 */
export default function VersionHistory({
  versions,
  isLoading,
  onLoadTemplate,
  onActivateVersion,
  onDeleteVersion,
  isActivating,
  isDeleting,
  showAllTypes = false,
}: VersionHistoryProps) {
  const t = useTranslations();
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Group versions by prompt type when showing all types
  const groupedVersions = showAllTypes
    ? versions.reduce((acc, version) => {
        const type = version.promptType;
        if (!acc[type]) {
          acc[type] = [];
        }
        acc[type].push(version);
        return acc;
      }, {} as Record<string, PromptVersion[]>)
    : null;

  const getPromptTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      ocr_extraction: 'สกัดข้อความ OCR (OCR Extraction)',
      rag_query_prompt: 'ค้นหาข้อมูล RAG (RAG Query)',
      rag_prep_prompt: 'เตรียมข้อมูล RAG (RAG Prep)',
      classification_prompt: 'จำแนกประเภทเอกสาร (Classification)',
    };
    return labels[type] || type;
  };

  // รีเซ็ต visible count เมื่อ versions เปลี่ยน (เช่น เปลี่ยน prompt type)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [versions, PAGE_SIZE]);

  // Infinite scroll ด้วย IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && visibleCount < versions.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, versions.length));
      }
    },
    [visibleCount, versions.length, PAGE_SIZE]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(handleObserver, { threshold: 0.1 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleObserver]);

  const visibleVersions = versions.slice(0, visibleCount);

  if (isLoading) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        <Clock className="mr-2 h-4 w-4 animate-spin text-primary" />
        {t('prompt_management.version_history')}...
      </div>
    );
  }

  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-3 border-b border-border/10">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <BookOpen className="h-4 w-4 text-primary" />
          {showAllTypes ? `${t('prompt_management.version_history')} (${t('prompt_management.all_types')})` : t('prompt_management.version_history')}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 px-3 sm:px-4 max-h-[500px] overflow-y-auto space-y-3">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-xs text-muted-foreground italic">
            {t('prompt_management.no_versions')}
          </div>
        ) : showAllTypes && groupedVersions ? (
          // Grouped view by prompt type — infinite scroll applies across all groups
          Object.entries(groupedVersions).map(([promptType, typeVersions]) => {
            const visibleGroupVersions = typeVersions.slice(0, visibleCount);
            return (
              <div key={promptType} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80 bg-muted/30 px-2 py-1.5 rounded">
                  <Folder className="h-3.5 w-3.5 text-primary" />
                  {getPromptTypeLabel(promptType)}
                </div>
                {visibleGroupVersions.map((version) => {
                  const isActive = version.isActive === true;
                  return (
                    <div
                      key={version.versionNumber}
                      className={cn(
                        'group relative rounded-lg border border-border/30 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/30 hover:bg-background/80',
                        isActive && 'border-emerald-500/20 bg-emerald-500/[0.02]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-bold text-foreground">
                              v{version.versionNumber}
                            </span>
                            {isActive ? (
                              <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] py-0 px-1.5 flex items-center gap-1 select-none">
                                <CheckCircle2 className="h-3 w-3" />
                                {t('prompt_management.is_active')}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 bg-background/40 select-none">
                                ร่าง (Inactive)
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              สร้าง: {new Date(version.createdAt).toLocaleString('th-TH')}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] text-muted-foreground hover:bg-secondary"
                            onClick={() => onLoadTemplate(version)}
                          >
                            โหลด (Load)
                          </Button>
                          {!isActive && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isActivating}
                                className="h-7 text-[10px] text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                                onClick={() => onActivateVersion(version.versionNumber)}
                              >
                                {t('prompt_management.activate_version')}
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
                        <div className="mt-2.5 rounded bg-muted/30 p-2 border border-border/10 flex gap-1.5 items-start text-[11px] text-muted-foreground select-text">
                          <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p className="leading-relaxed whitespace-pre-wrap">{version.manualNote}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        ) : (
          // Single type view — infinite scroll (T075)
          visibleVersions.map((version) => {
            const isActive = version.isActive === true;
            return (
              <div
                key={version.versionNumber}
                className={cn(
                  'group relative rounded-lg border border-border/30 bg-background/50 p-3.5 transition-all duration-200 hover:border-primary/30 hover:bg-background/80',
                  isActive && 'border-emerald-500/20 bg-emerald-500/[0.02]'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-foreground">
                        v{version.versionNumber}
                      </span>
                      {isActive ? (
                        <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 text-[10px] py-0 px-1.5 flex items-center gap-1 select-none">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('prompt_management.is_active')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground border-border/50 bg-background/40 select-none">
                          ร่าง (Inactive)
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        สร้าง: {new Date(version.createdAt).toLocaleString('th-TH')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-[10px] text-muted-foreground hover:bg-secondary"
                      onClick={() => onLoadTemplate(version)}
                    >
                      โหลด (Load)
                    </Button>
                    {!isActive && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isActivating}
                          className="h-7 text-[10px] text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                          onClick={() => onActivateVersion(version.versionNumber)}
                        >
                          {t('prompt_management.activate_version')}
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
                  <div className="mt-2.5 rounded bg-muted/30 p-2 border border-border/10 flex gap-1.5 items-start text-[11px] text-muted-foreground select-text">
                    <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="leading-relaxed whitespace-pre-wrap">{version.manualNote}</p>
                  </div>
                )}
              </div>
            );
          })
        )}
        {/* Sentinel สำหรับ infinite scroll — IntersectionObserver จะโหลดเพิ่มเมื่อ scroll ถึง */}
        <div ref={sentinelRef} className="py-1" />
        {visibleCount < versions.length && (
          <div className="text-center text-[10px] text-muted-foreground py-2">
            แสดง {visibleCount} จาก {versions.length} เวอร์ชัน
          </div>
        )}
      </CardContent>
    </Card>
  );
}
