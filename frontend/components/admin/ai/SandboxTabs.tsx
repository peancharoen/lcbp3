// File: frontend/components/admin/ai/SandboxTabs.tsx
// Change Log:
// - 2026-06-14: Created SandboxTabs component with 3-step testing (OCR -> AI Extract -> RAG Prep) (conforming to task T037)
// - 2026-06-15: ลบ Tesseract ออกจาก OCR Engine dropdown — canonical engines: auto + np-dms-ocr เท่านั้น (ADR-034)
// - 2026-06-15: เพิ่ม read-only prompt info banner แสดง version + template snippet ที่กำลังทดสอบ
// - 2026-06-18: อัปเดตให้รองรับ prompt_type='ocr_system' และ 'ocr_extraction' แยกกันตาม spec 238 (FR-006, FR-007)

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { adminAiPromptService } from '@/lib/services/admin-ai-prompt.service';
import { useProjects, useContracts } from '@/hooks/use-master-data';
import { toast } from 'sonner';
import {
  Upload,
  Play,
  FileText,
  FileJson,
  Database,
  ArrowRight,
  Loader2,
  CheckCircle,
  Trash2,
  FlaskConical,
} from 'lucide-react';

interface SandboxTabsProps {
  promptType?: string;
  selectedVersionNumber?: number;
  selectedTemplate?: string;
  onActivateVersion?: (versionNumber: number) => void;
}

interface ProjectOption {
  publicId: string;
  projectCode: string;
  projectName: string;
}

interface ContractOption {
  publicId: string;
  contractCode: string;
  contractName: string;
}

interface SandboxJobResult {
  ocrText?: string;
  answer?: string;
  status?: string;
  errorMessage?: string;
  ragChunks?: Array<{ text: string; summary: string }>;
  ragVectors?: number[][];
}

export default function SandboxTabs({
  promptType: _promptType = 'ocr_system',
  selectedVersionNumber,
  selectedTemplate: _selectedTemplate,
  onActivateVersion,
}: SandboxTabsProps) {
  // Master data state
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [selectedContract, setSelectedContract] = useState<string>('');
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? (projectsData as ProjectOption[]) : [];
  const { data: contractsData } = useContracts(selectedProject);
  const contracts = Array.isArray(contractsData) ? (contractsData as ContractOption[]) : [];

  // Sandbox states
  const [file, setFile] = useState<File | null>(null);
  const [ocrEngine, setOcrEngine] = useState<string>('auto');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [jobStatus, setJobStatus] = useState<'idle' | 'running' | 'completed' | 'failed'>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [statusText, setStatusText] = useState<string>('');

  // Results cache
  const [requestPublicId, setRequestPublicId] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string>('');
  const [extractedMetadata, setExtractedMetadata] = useState<Record<string, unknown> | null>(null);
  const [ragChunks, setRagChunks] = useState<Array<{ text: string; summary: string }> | null>(null);
  const [ragVectors, setRagVectors] = useState<number[][] | null>(null);

  // Track step completion status for activation gating (gap-2)
  const [step1Complete, setStep1Complete] = useState<boolean>(false);
  const [step2Complete, setStep2Complete] = useState<boolean>(false);
  const [step3Complete, setStep3Complete] = useState<boolean>(false);
  const allStepsComplete = step1Complete && step2Complete && step3Complete;

  // ADR-042: Full Pipeline + Clear Sandbox Data state
  const [activeTab, setActiveTab] = useState<'pipeline-sandbox' | 'full-pipeline'>('pipeline-sandbox');
  const [clearingData, setClearingData] = useState<boolean>(false);
  const [clearResult, setClearResult] = useState<{
    deletedCorrespondenceCount: number;
    vectorDeletionJobsEnqueued: number;
  } | null>(null);

  // Load active prompt templates from service (FR-009, FR-010)
  const [activeOcrSystemTemplate, setActiveOcrSystemTemplate] = useState<string>('');
  const [activeOcrSystemVersion, setActiveOcrSystemVersion] = useState<number | null>(null);
  const [activeExtractionTemplate, setActiveExtractionTemplate] = useState<string>('');
  const [activeExtractionVersion, setActiveExtractionVersion] = useState<number | null>(null);

  useEffect(() => {
    const loadActivePrompts = async () => {
      try {
        // Load OCR system prompt (Step 1)
        const ocrSystemPrompts = await adminAiPromptService.getPrompts('ocr_system');
        const ocrSystemActive = ocrSystemPrompts.find((p) => p.isActive);
        if (ocrSystemActive) {
          setActiveOcrSystemTemplate(ocrSystemActive.template);
          setActiveOcrSystemVersion(ocrSystemActive.versionNumber);
        }

        // Load AI extraction prompt (Step 2)
        const extractionPrompts = await adminAiPromptService.getPrompts('ocr_extraction');
        const extractionActive = extractionPrompts.find((p) => p.isActive);
        if (extractionActive) {
          setActiveExtractionTemplate(extractionActive.template);
          setActiveExtractionVersion(extractionActive.versionNumber);
        }
      } catch {
        // Silent fail - will use default warning banner
      }
    };
    loadActivePrompts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setOcrText('');
      setExtractedMetadata(null);
      setRagChunks(null);
      setRequestPublicId(null);
      setCurrentStep(1);
      setJobStatus('idle');
      setProgress(0);
      // Reset step completion flags (gap-2)
      setStep1Complete(false);
      setStep2Complete(false);
      setStep3Complete(false);
    }
  };

  const pollJobStatus = (id: string, step: number, onSuccess: (result: SandboxJobResult) => void) => {
    let interval = setInterval(async () => {
      try {
        const res = await adminAiService.getSandboxJobStatus(id);
        if (res.status === 'completed') {
          clearInterval(interval);
          setJobStatus('completed');
          setProgress(100);
          // Mark step as complete (gap-2)
          if (step === 1) setStep1Complete(true);
          if (step === 2) setStep2Complete(true);
          if (step === 3) setStep3Complete(true);
          onSuccess(res as SandboxJobResult);
        } else if (res.status === 'failed') {
          clearInterval(interval);
          setJobStatus('failed');
          setProgress(0);
          toast.error(res.errorMessage || 'การประมวลผลล้มเหลว');
        } else if (res.status === 'processing') {
          setProgress(step === 1 ? 50 : 60);
          setStatusText('กำลังประมวลผล...');
        }
      } catch (_err) {
        clearInterval(interval);
        setJobStatus('failed');
        setProgress(0);
        toast.error('ไม่สามารถดึงสถานะงานได้');
      }
    }, 2000);
  };

  const handleRunOcr = async () => {
    if (!file) {
      toast.error('กรุณาเลือกไฟล์ PDF สำหรับทดสอบ');
      return;
    }
    setJobStatus('running');
    setProgress(15);
    setStatusText('กำลังอัปโหลดและส่งเอกสารเข้าคิว OCR...');
    try {
      const res = await adminAiService.submitSandboxOcr(file, ocrEngine);
      setRequestPublicId(res.requestPublicId);
      pollJobStatus(res.requestPublicId, 1, (result) => {
        setOcrText(result.ocrText || '');
        setCurrentStep(2);
        toast.success('ทำ OCR สำเร็จแล้ว สามารถทำการสกัดข้อมูลต่อได้');
      });
    } catch (_err) {
      setJobStatus('failed');
      toast.error('เกิดข้อผิดพลาดในการรัน OCR');
    }
  };

  const handleRunExtract = async () => {
    if (!requestPublicId) {
      toast.error('กรุณาทำ OCR ก่อน');
      return;
    }
    if (!selectedProject) {
      toast.error('กรุณาเลือกโครงการสำหรับทดสอบ');
      return;
    }
    setJobStatus('running');
    setProgress(20);
    setStatusText('กำลังประมวลผลการสกัดข้อมูลเมตาดาต้า...');
    try {
      const res = await adminAiService.submitSandboxAiExtract(
        requestPublicId,
        activeExtractionVersion || undefined,
        selectedProject,
        selectedContract || undefined
      );
      pollJobStatus(res.requestPublicId, 2, (result) => {
        let parsed = null;
        try {
          parsed = result.answer ? JSON.parse(result.answer) : null;
        } catch {
          parsed = { error: 'ผลลัพธ์ไม่ใช่ JSON ที่ถูกต้อง', raw: result.answer };
        }
        setExtractedMetadata(parsed);
        setCurrentStep(3);
        toast.success('สกัดข้อมูลเมตาดาต้าสำเร็จ สามารถทดสอบ RAG Prep ต่อได้');
      });
    } catch (_err) {
      setJobStatus('failed');
      toast.error('เกิดข้อผิดพลาดในการสกัดข้อมูล');
    }
  };

  const handleRunRagPrep = async () => {
    if (!ocrText) {
      toast.error('ไม่มีข้อความ OCR สำหรับทดสอบ');
      return;
    }
    setJobStatus('running');
    setProgress(30);
    setStatusText('กำลังประมวลผลการทำ Semantic Chunking และสร้างเวกเตอร์ RAG...');
    try {
      const res = await adminAiService.submitSandboxRagPrep(ocrText);
      pollJobStatus(res.jobId, 3, (result) => {
        setRagChunks(result.ragChunks || []);
        setRagVectors(result.ragVectors || null);
        toast.success('วิเคราะห์การเตรียมข้อมูล RAG สำเร็จ');
      });
    } catch (_err) {
      setJobStatus('failed');
      toast.error('เกิดข้อผิดพลาดในการทำ RAG Prep');
    }
  };

  const handleActivate = () => {
    if (selectedVersionNumber && onActivateVersion) {
      onActivateVersion(selectedVersionNumber);
    }
  };

  // ADR-042: Clear Sandbox Data — ลบข้อมูลทดสอบทั้งหมดใน Sandbox Project
  const handleClearSandboxData = async () => {
    setClearingData(true);
    setClearResult(null);
    try {
      const result = await adminAiService.clearSandboxData();
      setClearResult(result);
      toast.success(
        `ลบข้อมูลทดสอบสำเร็จ: ${result.deletedCorrespondenceCount} เอกสาร, ${result.vectorDeletionJobsEnqueued} vector deletion jobs`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`ลบข้อมูลทดสอบล้มเหลว: ${msg}`);
    } finally {
      setClearingData(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
        <CardHeader className="border-b border-border/10 pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
                <Play className="h-4 w-4 text-primary" />
                {activeTab === 'pipeline-sandbox'
                  ? 'รันบอร์ดทดลองการทำงาน (3-Step Sandbox Testing)'
                  : 'Full Pipeline Testing (ADR-042)'}
              </CardTitle>
              <CardDescription className="text-xs">
                {activeTab === 'pipeline-sandbox'
                  ? 'ทดสอบความถูกต้องของเวอร์ชันพรอมต์จำลองกระบวนการจริง (OCR → AI Extract → RAG Prep)'
                  : 'ทดสอบ Production Flow แบบ end-to-end ผ่าน Sandbox Project (upload → create → submit → OCR → embedding)'}
              </CardDescription>
            </div>
            {/* Tab Switcher */}
            <div className="flex gap-1 rounded-lg border border-border/50 bg-background/50 p-0.5">
              <Button
                size="sm"
                variant={activeTab === 'pipeline-sandbox' ? 'default' : 'ghost'}
                className="h-7 px-3 text-[11px]"
                onClick={() => setActiveTab('pipeline-sandbox')}
              >
                <Play className="mr-1 h-3 w-3" />
                Pipeline Sandbox
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'full-pipeline' ? 'default' : 'ghost'}
                className="h-7 px-3 text-[11px]"
                onClick={() => setActiveTab('full-pipeline')}
              >
                <FlaskConical className="mr-1 h-3 w-3" />
                Full Pipeline
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-5">
          {/* Prompt info banner — read-only, แสดง version + template snippet ที่กำลังทดสอบ (FR-009, FR-010) */}
          <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/[0.03] px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-primary">พรอมต์ที่ใช้ทดสอบ (Prompt Under Test)</span>
            </div>
            <div className="space-y-2">
              {/* Step 1: OCR System Prompt */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Step 1 (OCR):</span>
                {activeOcrSystemVersion ? (
                  <span className="font-mono text-[10px] font-bold text-foreground">v{activeOcrSystemVersion}</span>
                ) : (
                  <span className="text-[10px] italic text-warning">ไม่มี Active</span>
                )}
              </div>
              {activeOcrSystemTemplate && (
                <p className="line-clamp-2 select-text whitespace-pre-wrap rounded bg-background/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {activeOcrSystemTemplate.slice(0, 200)}
                  {activeOcrSystemTemplate.length > 200 ? '…' : ''}
                </p>
              )}
              {/* Step 2: AI Extraction Prompt */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Step 2 (AI Extract):</span>
                {activeExtractionVersion ? (
                  <span className="font-mono text-[10px] font-bold text-foreground">v{activeExtractionVersion}</span>
                ) : (
                  <span className="text-[10px] italic text-warning">ไม่มี Active</span>
                )}
              </div>
              {activeExtractionTemplate && (
                <p className="line-clamp-2 select-text whitespace-pre-wrap rounded bg-background/50 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {activeExtractionTemplate.slice(0, 200)}
                  {activeExtractionTemplate.length > 200 ? '…' : ''}
                </p>
              )}
            </div>
          </div>

          {/* UI fallback warning when no active prompts (gap-3) */}
          {(!activeOcrSystemTemplate || !activeExtractionTemplate) && (
            <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/[0.05] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-warning">
                  ⚠️ คำเตือน: ไม่มี Prompt ที่เปิดใช้งานครบถ้วน
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-warning">
                {!activeOcrSystemTemplate && '• ไม่มี OCR System Prompt (Step 1) '}
                {!activeExtractionTemplate && '• ไม่มี AI Extraction Prompt (Step 2) '}
                ระบบจะใช้ค่าเริ่มต้น (default) แนะนำให้สร้างและเปิดใช้งาน Prompt เพื่อปรับแต่งความแม่นยำ
              </p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-4 border-b border-border/10 pb-4">
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">โครงการสำหรับสกัดบริบท</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-8 border-border/50 bg-background/50 text-xs">
                  <SelectValue placeholder="เลือกโครงการ..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.publicId} value={p.publicId} className="text-xs">
                      {p.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[200px] flex-1 space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">สัญญา (ถ้ามี)</Label>
              <Select value={selectedContract} onValueChange={setSelectedContract} disabled={!selectedProject}>
                <SelectTrigger className="h-8 border-border/50 bg-background/50 text-xs">
                  <SelectValue placeholder="เลือกสัญญา..." />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => (
                    <SelectItem key={c.publicId} value={c.publicId} className="text-xs">
                      {c.contractName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px] space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground">OCR Engine</Label>
              <Select value={ocrEngine} onValueChange={setOcrEngine}>
                <SelectTrigger className="h-8 border-border/50 bg-background/50 text-xs">
                  <SelectValue placeholder="เลือกเอนจิน..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto" className="text-xs">
                    Auto (np-dms-ocr อัตโนมัติ)
                  </SelectItem>
                  <SelectItem value="np-dms-ocr" className="text-xs">
                    np-dms-ocr (Force GPU)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 rounded-lg border border-border/30 bg-background/40 p-4 sm:flex-row">
            <div className="flex flex-1 items-center gap-3">
              <div className="rounded bg-primary/10 p-2">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">อัปโหลดไฟล์สำหรับทดสอบ Sandbox</Label>
                <p className="text-[10px] text-muted-foreground">เลือกไฟล์ PDF วิศวกรรม/ก่อสร้าง ขนาดไม่เกิน 50MB</p>
              </div>
            </div>
            <div className="relative flex cursor-pointer select-none items-center gap-2 overflow-hidden rounded bg-primary/90 px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95">
              <span>เลือกไฟล์เอกสาร...</span>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>
          </div>

          {file && (
            <div className="flex items-center gap-2 rounded border border-border/50 bg-secondary/20 px-3 py-1.5 font-mono text-xs text-muted-foreground">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate">{file.name}</span>
              <span>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
            </div>
          )}

          {/* Status indicator */}
          {jobStatus === 'running' && (
            <div className="space-y-2.5 rounded-lg border border-primary/20 bg-primary/[0.02] p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center font-semibold text-primary">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {statusText}
                </span>
                <span className="font-mono font-bold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          {/* Steps navigation and panels */}
          <div className="grid grid-cols-1 gap-6 pt-2 lg:grid-cols-12">
            {/* Step buttons */}
            <div className="flex gap-2.5 lg:col-span-3 lg:flex-col">
              <Button
                variant={currentStep === 1 ? 'default' : 'outline'}
                disabled={jobStatus === 'running' || !file}
                onClick={() => setCurrentStep(1)}
                className="h-9 w-full justify-start text-xs font-semibold"
              >
                <Badge className="mr-2 flex h-4 min-w-4 select-none items-center justify-center bg-secondary px-1 text-[9px] text-secondary-foreground">
                  1
                </Badge>
                Step 1: Run OCR
              </Button>
              <Button
                variant={currentStep === 2 ? 'default' : 'outline'}
                disabled={jobStatus === 'running' || !ocrText}
                onClick={() => setCurrentStep(2)}
                className="h-9 w-full justify-start text-xs font-semibold"
              >
                <Badge className="mr-2 flex h-4 min-w-4 select-none items-center justify-center bg-secondary px-1 text-[9px] text-secondary-foreground">
                  2
                </Badge>
                Step 2: AI Extract
              </Button>
              <Button
                variant={currentStep === 3 ? 'default' : 'outline'}
                disabled={jobStatus === 'running' || !extractedMetadata}
                onClick={() => setCurrentStep(3)}
                className="h-9 w-full justify-start text-xs font-semibold"
              >
                <Badge className="mr-2 flex h-4 min-w-4 select-none items-center justify-center bg-secondary px-1 text-[9px] text-secondary-foreground">
                  3
                </Badge>
                Step 3: RAG Prep
              </Button>
            </div>

            {/* Step detail views */}
            <div className="flex min-h-[300px] flex-col justify-between rounded-lg border border-border/30 bg-background/50 p-4 lg:col-span-9">
              {currentStep === 1 && (
                <div className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <FileText className="h-4 w-4 text-primary" />
                      Step 1: สกัดข้อความ OCR (OCR Extraction)
                    </h4>
                    <p className="text-[11px] leading-normal text-muted-foreground">
                      รันเอนจินสกัดข้อความเพื่อดึงตัวหนังสือดิบออกมาจากหน้าไฟล์ PDF ที่ส่งขึ้นไป
                      สามารถดูผลลัพธ์ข้อความดิบเพื่อประเมินความคมชัดของ OCR
                    </p>
                  </div>
                  {ocrText ? (
                    <div className="mt-3 max-h-[250px] min-h-[150px] flex-1 select-text overflow-y-auto whitespace-pre-wrap rounded border border-border/50 bg-secondary/30 p-3 font-mono text-[10px] leading-relaxed">
                      {ocrText}
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-[150px] flex-1 items-center justify-center rounded border border-dashed border-border/70 text-xs italic text-muted-foreground">
                      ยังไม่มีข้อมูล OCR คลิก "เริ่มรัน OCR" ด้านล่าง
                    </div>
                  )}
                  <div className="mt-4 flex justify-end border-t border-border/10 pt-4">
                    <Button
                      size="sm"
                      onClick={handleRunOcr}
                      disabled={jobStatus === 'running' || !file}
                      className="h-8 text-xs"
                    >
                      เริ่มรัน OCR (Run OCR)
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {currentStep === 2 && (
                <div className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <FileJson className="h-4 w-4 text-primary" />
                      Step 2: สกัดข้อมูลอัจฉริยะ (AI Metadata Extraction)
                    </h4>
                    <p className="text-[11px] leading-normal text-muted-foreground">
                      ส่งข้อความ OCR พร้อมบริบท Master data (โครงการ/สัญญา)
                      เข้าไปประมวลผลร่วมกับโมเดลหลักและเวอร์ชันพรอมต์ที่เลือก เพื่อแปลงเป็นโครงสร้างข้อมูล JSON อัจฉริยะ
                    </p>
                  </div>
                  {extractedMetadata ? (
                    <div className="mt-3 max-h-[250px] min-h-[150px] flex-1 select-text overflow-y-auto rounded border border-border/50 bg-secondary/30 p-3 font-mono text-[10px] leading-relaxed text-success">
                      <pre>{JSON.stringify(extractedMetadata, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-[150px] flex-1 items-center justify-center rounded border border-dashed border-border/70 text-xs italic text-muted-foreground">
                      ยังไม่มีผลลัพธ์การสกัดข้อมูล คลิก "เริ่มรันสกัดข้อมูล" ด้านล่าง
                    </div>
                  )}
                  <div className="mt-4 flex items-center justify-between border-t border-border/10 pt-4">
                    {selectedVersionNumber && onActivateVersion && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleActivate}
                        disabled={!allStepsComplete}
                        className="h-8 border-success/30 text-xs text-success hover:bg-success/10 disabled:cursor-not-allowed disabled:opacity-50"
                        title={
                          !allStepsComplete
                            ? 'ต้องทำครบทั้ง 3 ขั้นตอน (OCR → AI Extract → RAG Prep) ก่อนเปิดใช้งาน'
                            : ''
                        }
                      >
                        <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                        เปิดใช้งานเวอร์ชัน v{selectedVersionNumber}{' '}
                        {allStepsComplete ? 'ทันที' : '(ต้องทำครบ 3 ขั้นตอน)'}
                      </Button>
                    )}
                    <div className="flex-1 text-right">
                      <Button
                        size="sm"
                        onClick={handleRunExtract}
                        disabled={jobStatus === 'running' || !ocrText}
                        className="h-8 bg-primary text-xs text-primary-foreground hover:bg-primary/95"
                      >
                        เริ่มรันสกัดข้อมูล (Run AI Extract)
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 3 && (
                <div className="flex flex-1 flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Database className="h-4 w-4 text-primary" />
                      Step 3: เตรียมฐานข้อมูลค้นหา (RAG Prep Sandbox)
                    </h4>
                    <p className="text-[11px] leading-normal text-muted-foreground">
                      จำลองกระบวนการแบ่งข้อความออกเป็นส่วนๆ (Semantic Chunking)
                      ตามความเหมาะสมทางภาษาและความหมายของเอกสาร พร้อมแสดงขนาดเวกเตอร์ Dense/Sparse ที่สกัดสำหรับใช้ใน
                      Qdrant
                    </p>
                  </div>
                  {ragChunks ? (
                    <div className="mt-3 flex flex-1 flex-col gap-3 overflow-hidden">
                      <div className="flex select-none items-center justify-between rounded border border-border/50 bg-secondary/40 px-3 py-2 text-xs">
                        <span className="flex items-center gap-1 font-semibold text-foreground">
                          <CheckCircle className="h-4 w-4 text-success" />
                          ทำเวกเตอร์สำเร็จ: {ragVectors ? ragVectors.length : 0} เวกเตอร์
                        </span>
                        <Badge variant="outline" className="border-border/50 text-[10px]">
                          {' '}
                          chunks: {ragChunks.length}
                        </Badge>
                      </div>
                      <div className="mt-1 max-h-[200px] min-h-[120px] flex-1 space-y-2 overflow-y-auto">
                        {ragChunks.map((chunk, idx) => (
                          <div
                            key={idx}
                            className="select-text space-y-1 rounded border border-border/30 bg-background/80 p-2.5 text-[10px] transition-all hover:border-primary/20"
                          >
                            <div className="flex items-center justify-between font-bold text-primary">
                              <span>#Chunk {idx + 1}</span>
                              <Badge className="select-none px-1 py-0 text-[8px]">
                                {chunk.summary || 'หัวข้อหลัก'}
                              </Badge>
                            </div>
                            <p className="leading-relaxed text-muted-foreground">{chunk.text}</p>
                            {ragVectors && ragVectors[idx] && (
                              <div className="mt-2 border-t border-border/20 pt-2">
                                <span className="font-mono text-[9px] text-muted-foreground">
                                  Vector (first 5 dims): [
                                  {ragVectors[idx]
                                    .slice(0, 5)
                                    .map((v) => v.toFixed(3))
                                    .join(', ')}
                                  ...]
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex min-h-[150px] flex-1 items-center justify-center rounded border border-dashed border-border/70 text-xs italic text-muted-foreground">
                      ยังไม่มีผลลัพธ์ RAG Prep คลิก "เริ่มทดสอบ RAG Prep" ด้านล่าง
                    </div>
                  )}
                  <div className="mt-4 flex justify-end border-t border-border/10 pt-4">
                    <Button
                      size="sm"
                      onClick={handleRunRagPrep}
                      disabled={jobStatus === 'running' || !ocrText}
                      className="h-8 bg-success text-xs text-white hover:bg-success/90"
                    >
                      เริ่มทดสอบ RAG Prep (Test RAG Prep)
                      <CheckCircle className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ADR-042: Full Pipeline Tab — Clear Sandbox Data */}
      {activeTab === 'full-pipeline' && (
        <Card className="border border-border/50 bg-background/30 backdrop-blur-md">
          <CardHeader className="border-b border-border/10 pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FlaskConical className="h-4 w-4 text-primary" />
              Full Pipeline Testing — Sandbox Project (ADR-042)
            </CardTitle>
            <CardDescription className="text-xs">
              ทดสอบ Production Flow แบบ end-to-end ผ่าน Sandbox Project ที่แยกจากข้อมูลจริง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-lg border border-warning/30 bg-warning/[0.05] px-4 py-3">
              <p className="text-xs text-muted-foreground">
                เพื่อทดสอบ Full Pipeline ให้ใช้ Sandbox Project (project_code: SANDBOX) ในการสร้าง Correspondence ผ่าน
                code path เดียวกับ production แล้วตรวจสอบผลลัพธ์ OCR text และ embedding status
              </p>
            </div>

            {/* Clear Sandbox Data Section */}
            <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/[0.03] px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  <span className="text-sm font-semibold text-foreground">Clear Sandbox Data</span>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 text-xs"
                  onClick={handleClearSandboxData}
                  disabled={clearingData}
                >
                  {clearingData ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      ลบข้อมูลทดสอบทั้งหมด
                    </>
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ลบ Correspondence, Revision, Attachment, Workflow และ Vector ทั้งหมดใน Sandbox Project —
                ไม่กระทบข้อมูลโครงการจริง
              </p>
              {clearResult && (
                <div className="rounded border border-success/30 bg-success/[0.05] px-3 py-2 text-xs">
                  <span className="font-semibold text-success">ลบสำเร็จ:</span> ลบ{' '}
                  {clearResult.deletedCorrespondenceCount} เอกสาร, enqueue {clearResult.vectorDeletionJobsEnqueued}{' '}
                  vector deletion jobs
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
