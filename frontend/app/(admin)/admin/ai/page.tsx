// File: frontend/app/(admin)/admin/ai/page.tsx
// Change Log
// - 2026-05-21: เพิ่มหน้า AI Admin Console สำหรับเปิด/ปิด AI features.
// - 2026-05-21: เพิ่มส่วนแสดงผลสถานะสุขภาพของระบบ AI (Ollama, Qdrant, queues) แบบ real-time polling 30s (T030, T031).
// - 2026-05-21: เพิ่ม RAG Playground Sandbox tab สำหรับ Superadmin (T037, T038).
// - 2026-05-21: เพิ่ม OCR Sandbox tab พร้อมการอัปเดตสถานะและการแสดงผล JSON แบบมีสีสำหรับ Superadmin (T043-T045).
// - 2026-05-21: แก้ไข ESLint error เกี่ยวกับ any type และ console.error statement ให้ตรงตามมาตรฐาน Tier 1/2
// - 2026-05-25: เพิ่ม AI Model Management UI สำหรับเลือกโมเดลแบบไดนามิก (ADR-027).
// - 2026-05-30: นำเข้าและแสดงผล OcrEngineSelector component ใน Overview tab (T019, T020)

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Brain, Loader2, Power, ShieldCheck, Cpu, Database, Activity, Search, Info, HelpCircle, AlertCircle, Settings2, Trash2, ScanText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useAiStatus, useToggleAiFeatures, useAiHealth } from '@/hooks/use-ai-status';
import { projectService } from '@/lib/services/project.service';
import { adminAiService, AiSandboxJobResult, AiAvailableModel } from '@/lib/services/admin-ai.service';
import { toast } from 'sonner';
import OcrSandboxPromptManager from '@/components/admin/ai/OcrSandboxPromptManager';
import OcrEngineSelector from '@/components/admin/ai/OcrEngineSelector';

interface SandboxProject {
  publicId: string;
  projectName: string;
  projectCode: string;
}

export default function AiAdminConsolePage() {
  const { data, isLoading, isError, refetch, isFetching } = useAiStatus();
  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useAiHealth();
  const toggleMutation = useToggleAiFeatures();
  const aiEnabled = data?.aiFeaturesEnabled ?? false;
  const busy = isLoading || toggleMutation.isPending;
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [sandboxJobId, setSandboxJobId] = useState<string | null>(null);
  const [sandboxJobResult, setSandboxJobResult] = useState<AiSandboxJobResult | null>(null);
  const [isSandboxPolling, setIsSandboxPolling] = useState<boolean>(false);
  const [sandboxProgress, setSandboxProgress] = useState<number>(0);
  const [sandboxStatusText, setSandboxStatusText] = useState<string>('');

  // AI Model Management State (ADR-027)
  const { data: aiModelsData, refetch: refetchModels } = useQuery<{ models: AiAvailableModel[]; activeModel: string }>({
    queryKey: ['ai-available-models'],
    queryFn: async () => {
      return await adminAiService.getAvailableModels();
    },
  });
  const availableModels = aiModelsData?.models ?? [];
  const activeModel = aiModelsData?.activeModel ?? '';

  // VRAM Monitoring State (T034, T036, US2)
  const { data: vramStatus, refetch: refetchVram } = useQuery({
    queryKey: ['ai-vram-status'],
    queryFn: async () => {
      return await adminAiService.getVramStatus();
    },
    refetchInterval: 15000,
  });

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<SandboxProject[]>({
    queryKey: ['admin-sandbox-projects'],
    queryFn: async () => {
      const res = await projectService.getAll({ isActive: true, limit: 100 });
      return res as SandboxProject[];
    },
  });

  const handleToggle = async (enabled: boolean): Promise<void> => {
    await toggleMutation.mutateAsync(enabled);
  };

  const handleModelChange = async (modelId: string): Promise<void> => {
    try {
      const selectedModel = availableModels.find(m => m.modelId === modelId || String(m.id) === modelId);
      const name = selectedModel?.modelName || modelId;
      await adminAiService.setActiveModel(modelId);
      toast.success(`เปลี่ยนโมเดลเป็น ${name} สำเร็จ`);
      await refetchModels();
      refetchVram();
    } catch (err: unknown) {
      const errorResponse = err as { response?: { data?: { message?: string } } };
      const errorMsg = errorResponse.response?.data?.message || 'ไม่สามารถเปลี่ยนโมเดลได้เนื่องจาก VRAM ไม่เพียงพอ';
      toast.error(errorMsg);
    }
  };

  const handleToggleModel = async (modelName: string): Promise<void> => {
    try {
      await adminAiService.toggleModelActive(modelName);
      toast.success(`เปลี่ยนสถานะโมเดล ${modelName} สำเร็จ`);
      await refetchModels();
    } catch {
      toast.error('ไม่สามารถเปลี่ยนสถานะโมเดลได้');
    }
  };

  const handleRemoveModel = async (modelName: string): Promise<void> => {
    if (!confirm(`ต้องการลบโมเดล ${modelName} ใช่หรือไม่?`)) return;
    try {
      await adminAiService.removeModel(modelName);
      toast.success(`ลบโมเดล ${modelName} สำเร็จ`);
      await refetchModels();
    } catch {
      toast.error('ไม่สามารถลบโมเดลได้');
    }
  };

  const handleRefreshAll = async (): Promise<void> => {
    await Promise.all([refetch(), refetchHealth(), refetchModels(), refetchVram()]);
  };

  const handleSubmitSandbox = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!selectedProject) {
      toast.error('กรุณาเลือกโครงการ');
      return;
    }
    if (!question.trim()) {
      toast.error('กรุณากรอกคำถาม');
      return;
    }
    try {
      setSandboxJobResult(null);
      setSandboxProgress(10);
      setSandboxStatusText('กำลังส่งคำถาม RAG เข้าสู่ระบบคิว...');
      const response = await adminAiService.submitSandboxRag(selectedProject, question);
      setSandboxJobId(response.requestPublicId);
      setIsSandboxPolling(true);
      toast.success('ส่งคำถามเข้าสู่คิว sandbox สำเร็จ');
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'เกิดข้อผิดพลาดในการส่งคำถาม RAG');
      setSandboxProgress(0);
      setSandboxStatusText('');
    }
  };

  useEffect(() => {
    if (!sandboxJobId) return;
    let timer: NodeJS.Timeout;
    const pollSandboxJob = async () => {
      try {
        const res = await adminAiService.getSandboxJobStatus(sandboxJobId);
        setSandboxJobResult(res);
        if (res.status === 'pending') {
          setSandboxProgress(20);
          setSandboxStatusText('อยู่ระหว่างเข้าคิวรอประมวลผล (Pending in BullMQ)...');
        } else if (res.status === 'processing') {
          setSandboxProgress(60);
          setSandboxStatusText('กำลังค้นหาเอกสารผ่าน Qdrant และประมวลผล RAG ด้วย Local LLM...');
        } else if (res.status === 'completed') {
          setSandboxProgress(100);
          setSandboxStatusText('ประมวลผลคำตอบเสร็จสิ้น');
          setIsSandboxPolling(false);
          setSandboxJobId(null);
          toast.success('RAG Sandbox ตอบคำถามสำเร็จ');
        } else if (res.status === 'failed') {
          setSandboxProgress(100);
          setSandboxStatusText('การประมวลผลล้มเหลว');
          setIsSandboxPolling(false);
          setSandboxJobId(null);
          toast.error(res.errorMessage || 'เกิดข้อผิดพลาดในการรัน RAG Playground');
        } else if (res.status === 'cancelled') {
          setSandboxProgress(100);
          setSandboxStatusText('การประมวลผลถูกยกเลิก');
          setIsSandboxPolling(false);
          setSandboxJobId(null);
          toast.error('Sandbox job ถูกยกเลิก');
        } else if (res.status === 'not_found') {
          setSandboxProgress(15);
          setSandboxStatusText('กำลังเตรียมการจัดคิว...');
        }
      } catch {
        // เงียบข้อผิดพลาดตามนโยบาย UI
      }
    };
    pollSandboxJob();
    timer = setInterval(pollSandboxJob, 5000);
    return () => {
      clearInterval(timer);
    };
  }, [sandboxJobId]);

  const renderStatusBadge = (status?: 'HEALTHY' | 'DEGRADED' | 'DOWN') => {
    if (!status) return <Badge variant="outline">Unknown</Badge>;
    switch (status) {
      case 'HEALTHY':
        return <Badge className="border-emerald-500/20 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20">Healthy</Badge>;
      case 'DEGRADED':
        return <Badge className="border-amber-500/20 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">Degraded</Badge>;
      default:
        return <Badge variant="destructive">Down</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Brain className="h-6 w-6" />
            AI Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">ควบคุมสถานะ AI features สำหรับผู้ใช้ทั่วไป</p>
        </div>
        <Badge variant={aiEnabled ? 'default' : 'destructive'} className="w-fit">
          {aiEnabled ? 'AI Enabled' : 'AI Disabled'}
        </Badge>
      </div>
      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-[500px]">
          <TabsTrigger value="overview">Overview & Health</TabsTrigger>
          <TabsTrigger value="playground">RAG Playground</TabsTrigger>
          <TabsTrigger value="ocr">OCR Sandbox</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="h-4 w-4 text-primary" />
                  Ollama AI Engine
                </CardTitle>
                {isHealthLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : renderStatusBadge(health?.ollama?.status)}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">{health?.ollama?.latencyMs !== undefined ? `${health.ollama.latencyMs} ms` : '-'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">โมเดลที่โหลดอยู่:</span>
                  <div className="flex flex-wrap gap-1">
                    {health?.ollama?.models && health.ollama.models.length > 0 ? (
                      health.ollama.models.map((m) => (
                        <Badge key={m} variant="secondary" className="text-[10px] py-0 px-1">
                          {m}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground italic">ไม่มีโมเดลที่โหลดอยู่</span>
                    )}
                  </div>
                </div>
                {health?.ollama?.error && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-2">{health.ollama.error}</p>
                )}
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Database className="h-4 w-4 text-primary" />
                  Qdrant Vector DB
                </CardTitle>
                {isHealthLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : renderStatusBadge(health?.qdrant?.status)}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">{health?.qdrant?.latencyMs !== undefined ? `${health.qdrant.latencyMs} ms` : '-'}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">คอลเลกชัน:</span>
                  <div className="flex flex-wrap gap-1">
                    {health?.qdrant?.collections && health.qdrant.collections.length > 0 ? (
                      health.qdrant.collections.map((c) => (
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
            </Card>
            <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <ScanText className="h-4 w-4 text-primary" />
                  OCR Sidecar (Tesseract)
                </CardTitle>
                {isHealthLoading ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : renderStatusBadge(health?.ocr?.status)}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>ความเร็วตอบสนอง</span>
                  <span className="font-semibold text-foreground">{health?.ocr?.latencyMs !== undefined ? `${health.ocr.latencyMs} ms` : '-'}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>URL</span>
                  <span className="font-mono text-[10px] text-foreground truncate max-w-[160px]">{health?.ocr?.url ?? '-'}</span>
                </div>
                {health?.ocr?.error && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-2">{health.ocr.error}</p>
                )}
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Activity className="h-4 w-4 text-primary" />
                  BullMQ Queue Health
                </CardTitle>
                {isHealthLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    {health?.timestamp ? new Date(health.timestamp).toLocaleTimeString() : 'N/A'}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between font-medium text-[11px] border-b pb-1 mb-1">
                    <span>คิว / สถานะงาน</span>
                    <span>Active / Waiting / Failed</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      realtime
                      {health?.queues?.realtime?.isPaused && <span className="text-[9px] text-amber-500 font-sans">(Paused)</span>}
                    </span>
                    <span className="font-semibold text-foreground">
                      {health?.queues?.realtime?.active ?? 0} / {health?.queues?.realtime?.waiting ?? 0} /{' '}
                      <span className={(health?.queues?.realtime?.failed ?? 0) > 0 ? 'text-destructive' : ''}>
                        {health?.queues?.realtime?.failed ?? 0}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      batch
                      {health?.queues?.batch?.isPaused && <span className="text-[9px] text-amber-500 font-sans">(Paused)</span>}
                    </span>
                    <span className="font-semibold text-foreground">
                      {health?.queues?.batch?.active ?? 0} / {health?.queues?.batch?.waiting ?? 0} /{' '}
                      <span className={(health?.queues?.batch?.failed ?? 0) > 0 ? 'text-destructive' : ''}>
                        {health?.queues?.batch?.failed ?? 0}
                      </span>
                    </span>
                  </div>
                </div>
                {(health?.queues?.realtime?.error || health?.queues?.batch?.error) && (
                  <p className="mt-1 text-[10px] text-destructive line-clamp-1">
                    {health.queues.realtime.error || health.queues.batch.error}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md md:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Cpu className="h-4 w-4 text-primary" />
                  VRAM GPU Monitor
                </CardTitle>
                {vramStatus ? (
                  <Badge variant={vramStatus.usagePercent > 85 ? 'destructive' : 'secondary'} className="text-[10px]">
                    {vramStatus.usagePercent}% Used
                  </Badge>
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                )}
              </CardHeader>
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
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1 text-xs">
                        <span className="text-muted-foreground block">โมเดลที่โหลดบน GPU ในปัจจุบัน:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {vramStatus.loadedModels && vramStatus.loadedModels.length > 0 ? (
                            vramStatus.loadedModels.map((m) => (
                              <Badge key={m.modelId || m.modelName} className="bg-primary/10 text-primary border-none hover:bg-primary/20 text-[10px]">
                                {m.modelName} ({m.vramUsageMB} MB)
                              </Badge>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground italic">ไม่มีโมเดลที่โหลดค้างในหน่วยความจำ</span>
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
            </Card>
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Power className="h-5 w-5" />
                System Toggle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="text-base font-medium">
                    {aiEnabled ? 'AI พร้อมให้ผู้ใช้ทั่วไปใช้งาน' : 'AI ถูกปิดสำหรับผู้ใช้ทั่วไป'}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Superadmin ยังสามารถเข้าถึงส่วนทดสอบและดูแลระบบได้ตามสิทธิ์
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Switch
                    checked={aiEnabled}
                    disabled={busy || isError}
                    aria-label="Toggle AI features"
                    onCheckedChange={handleToggle}
                  />
                </div>
              </div>
              {isError && (
                <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  ไม่สามารถโหลดสถานะ AI ได้ กรุณาลองใหม่อีกครั้ง
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Model Management Card (ADR-027) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Settings2 className="h-5 w-5" />
                AI Model Management
                <Badge variant="outline" className="text-[10px]">ADR-027</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2 flex-1">
                  <label htmlFor="model-select" className="text-sm font-medium text-foreground">
                    โมเดล AI ที่ใช้งานอยู่ (Global)
                  </label>
                  <Select
                    value={availableModels.find((m) => m.modelName === activeModel)?.modelId || availableModels.find((m) => m.modelName === activeModel)?.id?.toString() || ''}
                    onValueChange={handleModelChange}
                  >
                    <SelectTrigger id="model-select" className="w-full sm:w-[300px]">
                      <SelectValue placeholder="-- เลือกโมเดล --" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels
                        .filter((m) => m.isActive)
                        .map((model) => (
                          <SelectItem key={model.modelId || model.modelName} value={model.modelId || model.id?.toString() || model.modelName}>
                            {model.modelName}
                            {model.isDefault && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">Default</Badge>
                            )}
                            {model.vramRequirementMB && (
                              <span className="ml-1 text-muted-foreground">({Math.round(model.vramRequirementMB / 1024 * 10) / 10}GB VRAM)</span>
                            )}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm text-muted-foreground">
                  โมเดลปัจจุบัน: <Badge variant="default">{activeModel || 'Loading...'}</Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">รายการโมเดลทั้งหมด</h4>
                <div className="space-y-2">
                  {availableModels.length === 0 ? (
                    <p className="text-sm text-muted-foreground">ไม่มีโมเดลในระบบ</p>
                  ) : (
                    availableModels.map((model) => (
                      <div
                        key={model.modelId || model.modelName}
                        className="flex items-center justify-between p-2 rounded border bg-background/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={model.isActive ? 'default' : 'secondary'}
                            className="text-[10px]"
                          >
                            {model.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <span className="text-sm font-medium">{model.modelName}</span>
                          {model.isDefault && (
                            <Badge variant="outline" className="text-[10px]">Default</Badge>
                          )}
                          {activeModel === model.modelName && (
                            <Badge variant="default" className="text-[10px] bg-emerald-500">Current</Badge>
                          )}
                          {model.vramRequirementMB && (
                            <Badge variant="outline" className="text-[10px] border-amber-500/20 text-amber-500 bg-amber-500/5">
                              {Math.round(model.vramRequirementMB / 1024 * 10) / 10} GB VRAM
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {!model.isDefault && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleToggleModel(model.modelName)}
                                disabled={activeModel === model.modelName && model.isActive}
                              >
                                {model.isActive ? 'Deactivate' : 'Activate'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveModel(model.modelName)}
                                disabled={model.isDefault || activeModel === model.modelName}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* OCR Engine Management Card (ADR-032) */}
          <OcrEngineSelector />

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5" />
                  Protection
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                เมื่อปิด AI ระบบจะบล็อก AI inference endpoints สำหรับผู้ใช้ทั่วไปด้วย HTTP 503
                และให้ผู้ใช้กรอกข้อมูลเองชั่วคราว
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Polling</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <span>
                  อัปเดตสถานะทุก 30 วินาที
                  {(isFetching || isHealthLoading) && !(isLoading || isHealthLoading) ? ' (กำลังรีเฟรช)' : ''}
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => void handleRefreshAll()}>
                  Refresh
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="playground" className="space-y-6">
          <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Search className="h-5 w-5 text-primary" />
                RAG Sandbox Playground (isolated)
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                พื้นที่ทดสอบสืบค้นเอกสารและสรุปผลด้วย Retrieval-Augmented Generation (RAG) คิวงานใช้ระดับความสำคัญพิเศษ (Priority 1)
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitSandbox} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="project-select" className="text-sm font-medium text-foreground">
                    เลือกโครงการ
                  </label>
                  {isProjectsLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังโหลดรายการโครงการ...
                    </div>
                  ) : (
                    <Select value={selectedProject} onValueChange={setSelectedProject} disabled={isSandboxPolling}>
                      <SelectTrigger id="project-select" className="w-full">
                        <SelectValue placeholder="-- กรุณาเลือกโครงการ --" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((proj) => (
                          <SelectItem key={proj.publicId} value={proj.publicId}>
                            {proj.projectName} ({proj.projectCode})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                <div className="space-y-2">
                  <label htmlFor="rag-question" className="text-sm font-medium text-foreground">
                    คำถามเพื่อการสืบค้น
                  </label>
                  <Textarea
                    id="rag-question"
                    placeholder="ตัวอย่าง: ค้นหาเอกสาร RFA ล่าสุดที่อนุมัติเกี่ยวกับ Shop Drawing ของงานระบบไฟฟ้า"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    disabled={isSandboxPolling}
                    rows={4}
                    className="resize-none border border-input bg-background/50"
                  />
                  <div className="text-right text-[11px] text-muted-foreground">
                    {question.length} ตัวอักษร
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={isSandboxPolling || !selectedProject || !question.trim()}
                    className="flex items-center gap-2"
                  >
                    {isSandboxPolling ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        กำลังประมวลผล Sandbox...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4" />
                        ส่งคำถาม Sandbox RAG
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          {isSandboxPolling && (
            <Card className="border border-amber-500/20 bg-amber-500/5">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                    <span>{sandboxStatusText}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{sandboxProgress}%</span>
                </div>
                <Progress value={sandboxProgress} className="h-2" />
                <div className="rounded bg-background/50 p-2 text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  ID คำขอ: {sandboxJobId}
                </div>
              </CardContent>
            </Card>
          )}
          {sandboxJobResult && (
            <div className="space-y-6">
              {sandboxJobResult.status === 'completed' && (
                <>
                  <Card className="border border-emerald-500/20 bg-background/50 backdrop-blur-md">
                    <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                      <CardTitle className="text-base text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                        <Brain className="h-4 w-4" />
                        คำตอบที่ประมวลผลได้ (RAG Sandbox Answer)
                      </CardTitle>
                      {sandboxJobResult.usedFallbackModel && (
                        <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/20 bg-amber-500/5">
                          โมเดลสำรอง (Fallback)
                        </Badge>
                      )}
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground select-text font-sans">
                        {sandboxJobResult.answer}
                      </div>
                      {sandboxJobResult.completedAt && (
                        <div className="mt-4 text-right text-[10px] text-muted-foreground">
                          เสร็จสิ้นเมื่อ: {new Date(sandboxJobResult.completedAt).toLocaleString()}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                        <HelpCircle className="h-4 w-4" />
                        เอกสารที่อ้างอิง ({sandboxJobResult.citations?.length ?? 0} รายการ)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sandboxJobResult.citations && sandboxJobResult.citations.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-1">
                          {sandboxJobResult.citations.map((cite, index) => (
                            <div
                              key={cite.pointId || index}
                              className="rounded-lg border border-border/40 bg-background/30 p-3 hover:bg-background/60 transition-colors space-y-2"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 text-[10px] border-none py-0">
                                    {cite.docType || 'Document'}
                                  </Badge>
                                  <span className="text-xs font-semibold text-foreground">
                                    {cite.docNumber || 'ไม่มีเลขที่เอกสาร'}
                                  </span>
                                </div>
                                <Badge variant="outline" className="text-[10px] py-0 border-border/50 text-muted-foreground">
                                  Score Match: {(cite.score * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              {cite.snippet && (
                                <p className="text-xs text-muted-foreground line-clamp-3 bg-background/50 p-2 rounded border border-border/20 italic font-sans leading-relaxed">
                                  &quot;{cite.snippet}&quot;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-xs text-muted-foreground italic">
                          ไม่มีการสกัดเอกสารอ้างอิงสำหรับคำถามนี้
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
              {sandboxJobResult.status === 'failed' && (
                <Card className="border border-destructive/20 bg-destructive/5">
                  <CardHeader className="flex flex-row items-center gap-2 pb-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    <CardTitle className="text-sm font-medium">ประมวลผล Sandbox ล้มเหลว</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {sandboxJobResult.errorMessage || 'เกิดข้อผิดพลาดในการเรียกใช้ Local LLM หรือ Vector DB ใน Sandbox Sandbox process ล้มเหลว กรุณาตรวจสอบสถานะสุขภาพของ Ollama Engine/Qdrant DB ใน Overview Tab'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ocr" className="space-y-6">
          <OcrSandboxPromptManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
