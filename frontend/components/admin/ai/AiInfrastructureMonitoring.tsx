// File: frontend/components/admin/ai/AiInfrastructureMonitoring.tsx
// Change Log:
// - 2026-08-02: แยก monitoring section ออกจาก AI Console page เพื่อใช้ใน layout ร่วมกับ sub-pages
// - 2026-06-19: เพิ่มฟีเจอร์ย่อ/ขยายสำหรับกลุ่มการ์ดและการ์ดเดี่ยวพร้อมเก็บสถานะใน localStorage

'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Cpu,
  Database,
  Activity,
  ScanText,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useAiHealth, AI_STATUS_QUERY_KEY } from '@/hooks/use-ai-status';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { MAIN_MODEL_NAME, OCR_MODEL_NAME, ensureArray } from './ai-constants';

interface VramLoadedModelView {
  modelId: string;
  modelName: string;
  vramUsageMB?: number;
}

/**
 * แปลงข้อมูล loaded models จาก response ให้เป็น VramLoadedModelView[]
 */
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
      };
      const rawName = model.modelName ?? model.name ?? `model-${index + 1}`;
      const name = rawName.toLowerCase();
      let normName = rawName;
      if (name.includes(OCR_MODEL_NAME)) {
        normName = OCR_MODEL_NAME;
      } else if (name.includes(MAIN_MODEL_NAME)) {
        normName = MAIN_MODEL_NAME;
      }
      return {
        modelId: model.modelId ?? rawName,
        modelName: normName,
        vramUsageMB: model.vramUsageMB,
      };
    }
    return {
      modelId: `unknown-${index}`,
      modelName: `Unknown Model ${index + 1}`,
    };
  });
}

/**
 * Component แสดงผลสถานะสุขภาพของระบบ AI (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM)
 * คงอยู่ใน layout แม้จะเลือก sub-menu อื่น
 */
export function AiInfrastructureMonitoring() {
  const queryClient = useQueryClient();
  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth, isFetching: isHealthFetching } = useAiHealth();
  const [isSectionCollapsed, setIsSectionCollapsed] = useState<boolean>(false);
  const [collapsedCards, setCollapsedCards] = useState<{
    ollama: boolean;
    qdrant: boolean;
    ocr: boolean;
    bullmq: boolean;
    vram: boolean;
  }>({
    ollama: false,
    qdrant: false,
    ocr: false,
    bullmq: false,
    vram: false,
  });

  const [throughput, setThroughput] = useState<{ realtime: number; batch: number } | null>(null);
  const prevCompletedRef = useRef<{ realtime: number; batch: number; timestamp: number } | null>(null);

  const { data: vramStatus, refetch: refetchVram } = useQuery({
    queryKey: ['ai-vram-status'],
    queryFn: async () => {
      return await adminAiService.getVramStatus();
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const savedSection = localStorage.getItem('ai_console_section_collapsed');
    if (savedSection !== null) {
      setIsSectionCollapsed(savedSection === 'true');
    }
    const savedCards = localStorage.getItem('ai_console_cards_collapsed');
    if (savedCards) {
      try {
        setCollapsedCards(JSON.parse(savedCards));
      } catch {
        // เงียบข้อผิดพลาด
      }
    }
  }, []);

  useEffect(() => {
    const realtimeCompleted = health?.queues?.realtime?.completed ?? 0;
    const batchCompleted = health?.queues?.batch?.completed ?? 0;
    const now = Date.now();
    if (prevCompletedRef.current) {
      const elapsedMin = (now - prevCompletedRef.current.timestamp) / 60000;
      if (elapsedMin > 0) {
        setThroughput({
          realtime: Math.max(0, Math.round((realtimeCompleted - prevCompletedRef.current.realtime) / elapsedMin)),
          batch: Math.max(0, Math.round((batchCompleted - prevCompletedRef.current.batch) / elapsedMin)),
        });
      }
    }
    prevCompletedRef.current = { realtime: realtimeCompleted, batch: batchCompleted, timestamp: now };
  }, [health?.queues?.realtime?.completed, health?.queues?.batch?.completed]);

  const toggleSection = () => {
    const nextVal = !isSectionCollapsed;
    setIsSectionCollapsed(nextVal);
    localStorage.setItem('ai_console_section_collapsed', String(nextVal));
  };

  const toggleCard = (cardKey: keyof typeof collapsedCards) => {
    const nextCards = { ...collapsedCards, [cardKey]: !collapsedCards[cardKey] };
    setCollapsedCards(nextCards);
    localStorage.setItem('ai_console_cards_collapsed', JSON.stringify(nextCards));
  };

  const handleRefresh = async (): Promise<void> => {
    await Promise.all([refetchHealth(), refetchVram()]);
    queryClient.invalidateQueries({ queryKey: AI_STATUS_QUERY_KEY });
  };

  const rawHealthOllamaModels = ensureArray<string>(health?.ollama?.models);
  const healthOllamaModels = Array.from(
    new Set(
      rawHealthOllamaModels.map((m) => {
        const name = m.toLowerCase();
        if (name.includes(OCR_MODEL_NAME)) return OCR_MODEL_NAME;
        if (name.includes(MAIN_MODEL_NAME)) return MAIN_MODEL_NAME;
        return m;
      })
    )
  );
  const healthQdrantCollections = ensureArray<string>(health?.qdrant?.collections);
  const vramLoadedModels = normalizeLoadedModels(vramStatus?.loadedModels);

  const renderStatusBadge = (status?: 'HEALTHY' | 'DEGRADED' | 'DOWN') => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    switch (status) {
      case 'HEALTHY':
        return (
          <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">
            Healthy
          </Badge>
        );
      case 'DEGRADED':
        return (
          <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">Degraded</Badge>
        );
      default:
        return <Badge variant="destructive">Down</Badge>;
    }
  };

  return (
    <>
      <div className="flex items-center justify-between border-b pb-2 mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          AI Engine Infrastructure Monitoring
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            อัปเดตทุก 30 วินาที{isHealthFetching ? ' (กำลังรีเฟรช)' : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => void handleRefresh()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="ml-1 text-xs">Refresh</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={toggleSection}
          >
            <ChevronUp className={`h-5 w-5 transition-transform duration-300 ${isSectionCollapsed ? 'rotate-180' : ''}`} />
          </Button>
        </div>
      </div>
      <div className={`transition-all duration-300 ease-in-out ${isSectionCollapsed ? 'max-h-0 opacity-0 overflow-hidden pointer-events-none' : 'max-h-[2000px] opacity-100'}`}>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-primary" />
                Ollama AI Engine
              </CardTitle>
              <div className="flex items-center gap-2">
                {isHealthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  renderStatusBadge(health?.ollama?.status)
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCard('ollama')}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${collapsedCards.ollama ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <div className={`transition-all duration-300 ease-in-out ${collapsedCards.ollama ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">
                    {health?.ollama?.latencyMs !== undefined ? `${health.ollama.latencyMs} ms` : '-'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">โมเดลที่โหลดอยู่:</span>
                  <div className="flex flex-wrap gap-1">
                    {healthOllamaModels.length > 0 ? (
                      healthOllamaModels.map((m) => (
                        <Badge key={m} variant="secondary" className="text-[10px] py-0 px-1">
                          {m}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">ไม่มีโมเดลที่โหลดอยู่</span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">โมเดลที่ใช้งานอยู่ (Active):</span>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-primary/10 text-primary border-none">
                      Main: {health?.activeModels?.main ?? '-'}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] py-0 px-1 bg-primary/10 text-primary border-none">
                      OCR: {health?.activeModels?.ocr ?? '-'}
                    </Badge>
                  </div>
                </div>
                {health?.ollama?.error && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-2">{health.ollama.error}</p>
                )}
              </CardContent>
            </div>
          </Card>
          <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Database className="h-4 w-4 text-primary" />
                Qdrant Vector DB
              </CardTitle>
              <div className="flex items-center gap-2">
                {isHealthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  renderStatusBadge(health?.qdrant?.status)
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCard('qdrant')}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${collapsedCards.qdrant ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <div className={`transition-all duration-300 ease-in-out ${collapsedCards.qdrant ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">
                    {health?.qdrant?.latencyMs !== undefined ? `${health.qdrant.latencyMs} ms` : '-'}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">คอลเลกชัน:</span>
                  <div className="flex flex-wrap gap-1">
                    {healthQdrantCollections.length > 0 ? (
                      healthQdrantCollections.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px] py-0 px-1 bg-background/30">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">ไม่มีคอลเลกชัน</span>
                    )}
                  </div>
                </div>
                {health?.qdrant?.error && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-2">{health.qdrant.error}</p>
                )}
              </CardContent>
            </div>
          </Card>
          <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ScanText className="h-4 w-4 text-primary" />
                OCR Sidecar (np-dms-ocr)
              </CardTitle>
              <div className="flex items-center gap-2">
                {isHealthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  renderStatusBadge(health?.ocr?.status)
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCard('ocr')}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${collapsedCards.ocr ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <div className={`transition-all duration-300 ease-in-out ${collapsedCards.ocr ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">
                    {health?.ocr?.latencyMs !== undefined ? `${health.ocr.latencyMs} ms` : '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>URL</span>
                  <span className="font-mono text-[10px] text-foreground truncate max-w-[160px]">
                    {health?.ocr?.url ?? '-'}
                  </span>
                </div>
                {health?.ocr?.error && <p className="mt-1 text-[10px] text-destructive line-clamp-2">{health.ocr.error}</p>}
              </CardContent>
            </div>
          </Card>
          <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Activity className="h-4 w-4 text-primary" />
                BullMQ Queue Health
              </CardTitle>
              <div className="flex items-center gap-2">
                {isHealthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCard('bullmq')}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${collapsedCards.bullmq ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <div className={`transition-all duration-300 ease-in-out ${collapsedCards.bullmq ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <CardContent className="space-y-2">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-medium text-[11px] border-b pb-1 mb-1">
                    <span>คิว / สถานะงาน</span>
                    <span>Active / Waiting / Done / Failed</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      realtime
                      {health?.queues?.realtime?.isPaused && (
                        <span className="text-[9px] text-amber-500 font-sans">(Paused)</span>
                      )}
                    </span>
                    <span className="font-semibold text-foreground">
                      {health?.queues?.realtime?.active ?? 0} / {health?.queues?.realtime?.waiting ?? 0} /{' '}
                      <span className="text-emerald-500">{health?.queues?.realtime?.completed ?? 0}</span> /{' '}
                      <span className={(health?.queues?.realtime?.failed ?? 0) > 0 ? 'text-destructive' : ''}>
                        {health?.queues?.realtime?.failed ?? 0}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      batch
                      {health?.queues?.batch?.isPaused && (
                        <span className="text-[9px] text-amber-500 font-sans">(Paused)</span>
                      )}
                    </span>
                    <span className="font-semibold text-foreground">
                      {health?.queues?.batch?.active ?? 0} / {health?.queues?.batch?.waiting ?? 0} /{' '}
                      <span className="text-emerald-500">{health?.queues?.batch?.completed ?? 0}</span> /{' '}
                      <span className={(health?.queues?.batch?.failed ?? 0) > 0 ? 'text-destructive' : ''}>
                        {health?.queues?.batch?.failed ?? 0}
                      </span>
                    </span>
                  </div>
                </div>
                {throughput && (throughput.realtime > 0 || throughput.batch > 0) && (
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-1">
                    <span>Throughput (jobs/min)</span>
                    <span>RT: {throughput.realtime} | Batch: {throughput.batch}</span>
                  </div>
                )}
                {(health?.queues?.realtime?.error || health?.queues?.batch?.error) && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-1">
                    {health.queues.realtime.error || health.queues.batch.error}
                  </p>
                )}
              </CardContent>
            </div>
          </Card>
          <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md md:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Cpu className="h-4 w-4 text-primary" />
                VRAM GPU Monitor
              </CardTitle>
              <div className="flex items-center gap-2">
                {vramStatus ? (
                  <Badge variant={vramStatus.usagePercent > 85 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {vramStatus.usagePercent}% Used
                  </Badge>
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => toggleCard('vram')}
                >
                  <ChevronUp className={`h-4 w-4 transition-transform duration-300 ${collapsedCards.vram ? 'rotate-180' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <div className={`transition-all duration-300 ease-in-out ${collapsedCards.vram ? 'max-h-0 opacity-0 overflow-hidden' : 'max-h-[500px] opacity-100'}`}>
              <CardContent className="space-y-4">
                {vramStatus ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">GPU VRAM Usage</span>
                        <span className="font-semibold text-foreground">
                          {vramStatus.usedVRAMMB} MB / {vramStatus.totalVRAMMB} MB
                        </span>
                      </div>
                      <Progress value={vramStatus.usagePercent} className="h-2" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">VRAM ที่เหลือว่าง</span>
                        <span className="font-semibold text-emerald-500">
                          {vramStatus.totalVRAMMB - vramStatus.usedVRAMMB} MB
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 text-xs">
                        <span className="text-muted-foreground block">โมเดลที่โหลดบน GPU ในปัจจุบัน:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vramLoadedModels.length > 0 ? (
                            vramLoadedModels.map((m) => (
                              <Badge
                                key={m.modelId}
                                className="bg-primary/10 text-primary border-none hover:bg-primary/20 text-[10px]"
                              >
                                {m.modelName}
                                {typeof m.vramUsageMB === 'number' ? ` (${m.vramUsageMB} MB)` : ''}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">
                              ไม่มีโมเดลที่โหลดค้างในหน่วยความจำ
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1 text-xs sm:text-right">
                        <span className="text-muted-foreground block">ความสามารถในการโหลดโมเดลใหม่:</span>
                        <Badge variant={vramStatus.canLoadModel ? 'default' : 'destructive'} className="mt-1 text-[10px]">
                          {vramStatus.canLoadModel ? 'พร้อมโหลดโมเดลหลัก' : 'หน่วยความจำไม่เพียงพอ (OOM Guard)'}
                        </Badge>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic text-center py-4">กำลังดึงข้อมูลสถานะ GPU VRAM...</p>
                )}
              </CardContent>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
