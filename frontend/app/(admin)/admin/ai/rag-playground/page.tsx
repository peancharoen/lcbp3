// File: frontend/app/(admin)/admin/ai/rag-playground/page.tsx
// Change Log:
// - 2026-08-02: แยก RAG Playground ออกจาก AI Console page หลัก

'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  Loader2,
  Brain,
  Info,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { projectService } from '@/lib/services/project.service';
import { adminAiService, AiSandboxJobResult, AiRagCitation } from '@/lib/services/admin-ai.service';
import { toast } from 'sonner';
import { ensureArray } from '@/components/admin/ai/ai-constants';

interface SandboxProject {
  publicId: string;
  projectName: string;
  projectCode: string;
}

/**
 * หน้า RAG Playground — ทดสอบสืบค้นเอกสารและสรุปผลด้วย RAG ในสภาพแวดล้อม sandbox
 */
export default function RagPlaygroundPage() {
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [question, setQuestion] = useState<string>('');
  const [sandboxJobId, setSandboxJobId] = useState<string | null>(null);
  const [sandboxJobResult, setSandboxJobResult] = useState<AiSandboxJobResult | null>(null);
  const [isSandboxPolling, setIsSandboxPolling] = useState<boolean>(false);
  const [sandboxProgress, setSandboxProgress] = useState<number>(0);
  const [sandboxStatusText, setSandboxStatusText] = useState<string>('');

  const { data: projects = [], isLoading: isProjectsLoading } = useQuery<SandboxProject[]>({
    queryKey: ['admin-sandbox-projects'],
    queryFn: async () => {
      const res = await projectService.getAll({ isActive: true, limit: 100 });
      return res as SandboxProject[];
    },
  });

  const sandboxProjects = ensureArray<SandboxProject>(projects);
  const sandboxCitations = ensureArray<AiRagCitation>(sandboxJobResult?.citations);

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

  return (
    <div className="space-y-6">
      <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            RAG Sandbox Playground (isolated)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            พื้นที่ทดสอบสืบค้นเอกสารและสรุปผลด้วย Retrieval-Augmented Generation (RAG) คิวงานใช้ระดับความสำคัญพิเศษ
            (Priority 1)
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
                    {sandboxProjects.map((proj) => (
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
              <div className="text-right text-[11px] text-muted-foreground">{question.length} ตัวอักษร</div>
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
                    <Badge
                      variant="outline"
                      className="text-[10px] text-amber-500 border-amber-500/20 bg-amber-500/5"
                    >
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
                  {sandboxCitations.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-1">
                      {sandboxCitations.map((cite, index) => (
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
                            <Badge
                              variant="outline"
                              className="text-[10px] py-0 border-border/50 text-muted-foreground"
                            >
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
                  {sandboxJobResult.errorMessage ||
                    'เกิดข้อผิดพลาดในการเรียกใช้ Local LLM หรือ Vector DB ใน Sandbox Sandbox process ล้มเหลว กรุณาตรวจสอบสถานะสุขภาพของ Ollama Engine/Qdrant DB ในส่วน Monitoring ด้านบน'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
