// File: frontend/components/admin/ai/CombinedOllamaEngineCard.tsx
// Change Log:
// - 2026-08-24: ADR-048 T012/T013 — สร้าง CombinedOllamaEngineCard รวม Ollama status + VRAM table
//   พร้อม Confirmation Dialog สำหรับ VRAM Unload (cold-start warning)
// - 2026-09-04: แก้ display bugs ที่ทำให้เข้าใจผิดว่า np-dms-ocr + np-dms-ai โหลดพร้อมกันเกิน VRAM:
//   (1) เปลี่ยน label "Active models" → "Configured models" (ค่านี้คือชื่อ model ที่ config ไว้
//       จาก env ไม่ใช่สถานะโหลดจริงใน GPU — health.activeModels มาจาก
//       ollamaService.getMainModelName()/getOcrModelName() เสมอ ไม่เช็ค /api/ps เลย)
//   (2) "Loaded on Ollama" badges เปลี่ยนจากอ่าน health.ollama.models (poll 30s) เป็นอ่าน
//       vramStatus.loadedModels (poll 15s) แหล่งเดียวกับตาราง catalog — กัน snapshot ไม่ตรงกัน
//       ระหว่าง 2 query ที่ independent poll คนละรอบเวลา
//   (3) เพิ่มแสดง "อัปเดตล่าสุด" จาก vramStatus.lastUpdated
//   (4) รวม header badge "X% VRAM" เข้ากับตัวเลข used/total ในบอดี้การ์ดเป็นชุดเดียว

'use client';

import { useState } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Loader2, Power, PowerOff, AlertTriangle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  adminAiService,
  type AiSystemHealth,
  type VramStatusResponse,
  type BgeStatusResponse,
} from '@/lib/services/admin-ai.service';
import { MAIN_MODEL_NAME, MAIN_MODEL_30B_NAME, OCR_MODEL_NAME, BGE_MODEL_NAME, toCanonicalModel } from './ai-constants';

interface CombinedOllamaEngineCardProps {
  health: AiSystemHealth | undefined;
  isHealthLoading: boolean;
  vramStatus: VramStatusResponse | undefined;
  isVramLoading: boolean;
  isVramError: boolean;
}

interface VramLoadedModelView {
  modelId: string;
  modelName: string;
  vramUsageMB?: number;
  modelSizeMB?: number;
}

/** แปลงข้อมูล loaded models จาก response ให้เป็น VramLoadedModelView[] */
function normalizeLoadedModels(value: unknown): VramLoadedModelView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item, index) => {
    if (typeof item === 'string') {
      const name = item.toLowerCase();
      let normName = item;
      if (name.includes(OCR_MODEL_NAME)) {
        normName = OCR_MODEL_NAME;
      } else if (name.includes(MAIN_MODEL_30B_NAME)) {
        normName = MAIN_MODEL_30B_NAME;
      } else if (name.includes(MAIN_MODEL_NAME)) {
        normName = MAIN_MODEL_NAME;
      }
      return {
        modelId: `${item}-${index}`,
        modelName: normName,
      };
    }
    if (item && typeof item === 'object') {
      const model = item as {
        modelId?: string;
        modelName?: string;
        name?: string;
        vramUsageMB?: number;
        modelSizeMB?: number;
      };
      const rawName = model.modelName ?? model.name ?? `model-${index + 1}`;
      const name = rawName.toLowerCase();
      let normName = rawName;
      if (name.includes(OCR_MODEL_NAME)) {
        normName = OCR_MODEL_NAME;
      } else if (name.includes(MAIN_MODEL_30B_NAME)) {
        normName = MAIN_MODEL_30B_NAME;
      } else if (name.includes(MAIN_MODEL_NAME)) {
        normName = MAIN_MODEL_NAME;
      }
      return {
        modelId: model.modelId ?? rawName,
        modelName: normName,
        vramUsageMB: model.vramUsageMB,
        modelSizeMB: model.modelSizeMB,
      };
    }
    return {
      modelId: `unknown-${index}`,
      modelName: `Unknown Model ${index + 1}`,
    };
  });
}

const renderStatusBadge = (status?: 'HEALTHY' | 'DEGRADED' | 'DOWN') => {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  switch (status) {
    case 'HEALTHY':
      return <Badge className="border-success/20 bg-success/10 text-success hover:bg-success/20">Healthy</Badge>;
    case 'DEGRADED':
      return <Badge className="border-warning/20 bg-warning/10 text-warning hover:bg-warning/20">Degraded</Badge>;
    default:
      return <Badge variant="destructive">Down</Badge>;
  }
};

/**
 * Card รวม Ollama status และ VRAM model table เป็นหนึ่งเดียว (ADR-048 T012)
 * พร้อมปุ่ม Load/Unload และ Confirmation Dialog สำหรับ VRAM Unload (T013)
 */
export function CombinedOllamaEngineCard({
  health,
  isHealthLoading,
  vramStatus,
  isVramLoading,
  isVramError,
}: CombinedOllamaEngineCardProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [pendingUnloadModel, setPendingUnloadModel] = useState<string | null>(null);

  const vramLoadedModels = normalizeLoadedModels(vramStatus?.loadedModels);
  // "Loaded on Ollama" badges: อ่านจาก vramStatus (แหล่งเดียวกับตาราง catalog ด้านล่าง) แทน
  // health.ollama.models — สอง query นี้ poll คนละรอบเวลา (health 30s, vramStatus 15s) ถ้าอ่าน
  // คนละแหล่งจะโชว์ snapshot ไม่ตรงกันได้ระหว่างโมเดลกำลังสลับ (เช่น batch OCR phase)
  const loadedModelNames = Array.from(new Set(vramLoadedModels.map((m) => toCanonicalModel(m.modelName))));

  // FR-005: Canonical model catalog — แสดงทั้ง loaded และ unloaded models พร้อม residency status
  const canonicalCatalog = [MAIN_MODEL_NAME, MAIN_MODEL_30B_NAME, OCR_MODEL_NAME];
  const loadedModelMap = new Map<string, VramLoadedModelView>();
  for (const m of vramLoadedModels) {
    const canonical = toCanonicalModel(m.modelName);
    loadedModelMap.set(canonical, m);
  }
  const catalogRows = canonicalCatalog.map((canonicalName) => {
    const loaded = loadedModelMap.get(canonicalName);
    return {
      canonicalName,
      isLoaded: Boolean(loaded),
      vramUsageMB: loaded?.vramUsageMB,
      modelSizeMB: loaded?.modelSizeMB,
    };
  });

  const loadMutation = useMutation({
    mutationFn: async (modelName: string) => {
      return await adminAiService.loadModelVram(modelName);
    },
    onSuccess: (_data, modelName) => {
      toast.success(t('ai.vram.action.loadSuccess', { modelName }));
      void queryClient.invalidateQueries({ queryKey: ['ai-vram-status'] });
    },
    onError: (error: unknown, modelName) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('ai.vram.action.loadError', { modelName }), { description: message });
    },
  });

  const unloadMutation = useMutation({
    mutationFn: async (modelName: string) => {
      return await adminAiService.unloadModelVram(modelName);
    },
    onSuccess: (_data, modelName) => {
      toast.success(t('ai.vram.action.unloadSuccess', { modelName }));
      void queryClient.invalidateQueries({ queryKey: ['ai-vram-status'] });
    },
    onError: (error: unknown, modelName) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(t('ai.vram.action.unloadError', { modelName }), { description: message });
    },
  });

  const handleConfirmUnload = () => {
    if (pendingUnloadModel) {
      void unloadMutation.mutate(pendingUnloadModel);
      setPendingUnloadModel(null);
    }
  };

  // BGE status query (Sidecar lazy-load, ไม่ได้โหลดใน Ollama)
  const { data: bgeStatus } = useQuery<BgeStatusResponse>({
    queryKey: ['ai-bge-status'],
    queryFn: () => adminAiService.getBgeStatus(),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  const bgeLoadMutation = useMutation({
    mutationFn: () => adminAiService.loadBgeModels(),
    onSuccess: () => {
      toast.success('BGE models loaded (lazy-load)');
      void queryClient.invalidateQueries({ queryKey: ['ai-bge-status'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Failed to load BGE models', { description: message });
    },
  });

  const bgeUnloadMutation = useMutation({
    mutationFn: () => adminAiService.unloadBgeModels(),
    onSuccess: () => {
      toast.success('BGE models unloaded — GPU memory freed for Ollama');
      void queryClient.invalidateQueries({ queryKey: ['ai-bge-status'] });
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Failed to unload BGE models', { description: message });
    },
  });

  const isBusy =
    loadMutation.isPending || unloadMutation.isPending || bgeLoadMutation.isPending || bgeUnloadMutation.isPending;

  return (
    <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md md:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Cpu className="h-4 w-4 text-primary" />
          Ollama Engine &amp; VRAM Management
        </CardTitle>
        <div className="flex items-center gap-2">
          {isHealthLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : (
            renderStatusBadge(health?.ollama?.status)
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Ollama status section */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ollama latency</span>
              <span className="font-semibold text-foreground">
                {health?.ollama?.latencyMs !== undefined ? `${health.ollama.latencyMs} ms` : '-'}
              </span>
            </div>
            <div className="space-y-1">
              {/* ชื่อ model ที่ config ไว้ (env) — "ตั้งค่าไว้" ไม่ใช่สถานะโหลดจริงใน GPU ขณะนี้
                  (ดู "Loaded on Ollama" ด้านขวา หรือตาราง catalog ด้านล่างสำหรับสถานะจริง) */}
              <span className="text-[10px] text-muted-foreground">Configured models:</span>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline" className="border-none px-1 py-0 text-[10px] text-muted-foreground">
                  Main: {health?.activeModels?.main ?? '-'}
                </Badge>
                <Badge variant="outline" className="border-none px-1 py-0 text-[10px] text-muted-foreground">
                  OCR: {health?.activeModels?.ocr ?? '-'}
                </Badge>
              </div>
            </div>
            {health?.ollama?.error && (
              <p className="mt-1 line-clamp-2 text-[10px] text-destructive">{health.ollama.error}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <span className="text-[10px] text-muted-foreground">Loaded on Ollama (live):</span>
            <div className="flex flex-wrap gap-1">
              {loadedModelNames.length > 0 ? (
                loadedModelNames.map((m) => (
                  <Badge
                    key={m}
                    className="border-success/20 bg-success/10 px-1 py-0 text-[10px] text-success hover:bg-success/20"
                  >
                    {m}
                  </Badge>
                ))
              ) : (
                <span className="text-[10px] italic text-muted-foreground">ไม่มีโมเดลที่โหลดอยู่</span>
              )}
            </div>
          </div>
        </div>

        {/* VRAM section */}
        {isVramError && !vramStatus ? (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{t('ai.vram.error')}</span>
          </div>
        ) : isVramLoading && !vramStatus ? (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : vramStatus ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">GPU VRAM Usage</span>
                <span className="font-semibold text-foreground">
                  {vramStatus.usedVRAMMB} MB / {vramStatus.totalVRAMMB} MB{' '}
                  <span className={vramStatus.usagePercent > 85 ? 'text-destructive' : 'text-muted-foreground'}>
                    ({vramStatus.usagePercent}%)
                  </span>
                </span>
              </div>
              <Progress value={vramStatus.usagePercent} className="h-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">VRAM ที่เหลือว่าง</span>
                <span className="font-semibold text-success">{vramStatus.totalVRAMMB - vramStatus.usedVRAMMB} MB</span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>อัปเดตล่าสุด</span>
                <span>{new Date(vramStatus.lastUpdated).toLocaleTimeString('th-TH')}</span>
              </div>
            </div>

            {/* FR-005: Canonical model catalog with residency status + Load/Unload controls */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t('ai.vram.catalog.title')}</span>
                <Badge variant={vramStatus.canLoadModel ? 'default' : 'destructive'} className="text-[10px]">
                  {vramStatus.canLoadModel ? t('ai.vram.catalog.capacityOk') : t('ai.vram.catalog.capacityLow')}
                </Badge>
              </div>
              <div className="overflow-hidden rounded-md border border-border/50">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30 text-muted-foreground">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">{t('ai.vram.catalog.column.model')}</th>
                      <th className="px-2 py-1.5 text-left font-medium">{t('ai.vram.catalog.column.residency')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('ai.vram.catalog.column.modelSize')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('ai.vram.catalog.column.vram')}</th>
                      <th className="px-2 py-1.5 text-right font-medium">{t('ai.queue.column.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalogRows.map((row) => (
                      <tr key={row.canonicalName} className="border-t border-border/30">
                        <td className="px-2 py-1.5 font-mono">{row.canonicalName}</td>
                        <td className="px-2 py-1.5">
                          {row.isLoaded ? (
                            <Badge className="border-success/20 bg-success/10 text-[10px] text-success hover:bg-success/20">
                              {t('ai.vram.residency.loaded')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {t('ai.vram.residency.notLoaded')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {typeof row.modelSizeMB === 'number' ? row.modelSizeMB : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {typeof row.vramUsageMB === 'number' ? row.vramUsageMB : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {row.isLoaded ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              disabled={isBusy}
                              onClick={() => setPendingUnloadModel(row.canonicalName)}
                              aria-label={t('ai.vram.action.unload')}
                            >
                              <PowerOff className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px]">{t('ai.vram.action.unload')}</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-success hover:bg-success/10 hover:text-success"
                              disabled={isBusy || !vramStatus.canLoadModel}
                              onClick={() => void loadMutation.mutate(row.canonicalName)}
                              aria-label={t('ai.vram.action.load')}
                            >
                              <Power className="h-3.5 w-3.5" />
                              <span className="ml-1 text-[10px]">{t('ai.vram.action.load')}</span>
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* BGE row — Sidecar lazy-load (ไม่ได้โหลดใน Ollama) */}
                    <tr className="border-t border-border/30 bg-purple-500/5">
                      <td className="px-2 py-1.5 font-mono">
                        {BGE_MODEL_NAME}
                        <span className="ml-1 text-[9px] text-muted-foreground">(sidecar)</span>
                      </td>
                      <td className="px-2 py-1.5">
                        {bgeStatus?.bgeLoaded ? (
                          <Badge className="border-purple-500/20 bg-purple-500/10 text-[10px] text-purple-600 hover:bg-purple-500/20 dark:text-purple-400">
                            {t('ai.vram.residency.loaded')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {t('ai.vram.residency.notLoaded')}
                          </Badge>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted-foreground">
                        {bgeStatus?.bgeLoaded ? '~4800' : '—'}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {bgeStatus?.bgeLoaded ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={isBusy}
                            onClick={() => void bgeUnloadMutation.mutate()}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                            <span className="ml-1 text-[10px]">{t('ai.vram.action.unload')}</span>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-success hover:bg-success/10 hover:text-success"
                            disabled={isBusy}
                            onClick={() => void bgeLoadMutation.mutate()}
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span className="ml-1 text-[10px]">{t('ai.vram.action.load')}</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Busy indicator */}
              {isBusy && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t('ai.vram.busy')}
                </div>
              )}
            </div>
          </>
        ) : (
          <p className="py-2 text-center text-xs italic text-muted-foreground">กำลังดึงข้อมูลสถานะ GPU VRAM...</p>
        )}
      </CardContent>

      {/* T013: Confirmation Dialog สำหรับ VRAM Unload */}
      <AlertDialog open={pendingUnloadModel !== null} onOpenChange={(open) => !open && setPendingUnloadModel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {t('ai.vram.unload.confirmTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('ai.vram.unload.confirmDescription', { modelName: pendingUnloadModel ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unloadMutation.isPending}>
              {t('ai.vram.unload.confirmCancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unloadMutation.isPending}
              onClick={handleConfirmUnload}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unloadMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t('ai.vram.unload.confirmAction')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default CombinedOllamaEngineCard;
