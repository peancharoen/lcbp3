// File: frontend/components/admin/ai/SandboxTabs.tsx
// Change Log:
// - 2026-06-14: Created SandboxTabs component with 3-step testing (OCR -> AI Extract -> RAG Prep) (conforming to task T037)

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAiService } from '@/lib/services/admin-ai.service';
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
} from 'lucide-react';

interface SandboxTabsProps {
  promptType: string;
  selectedVersionNumber?: number;
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
  ragVectors?: unknown[];
}

export default function SandboxTabs({
  promptType: _promptType,
  selectedVersionNumber,
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
  const [ragVectorsCount, setRagVectorsCount] = useState<number>(0);

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
        selectedVersionNumber,
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
        setRagVectorsCount(result.ragVectors ? result.ragVectors.length : 0);
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

  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-3 border-b border-border/10">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
          <Play className="h-4 w-4 text-primary" />
          รันบอร์ดทดลองการทำงาน (3-Step Sandbox Testing)
        </CardTitle>
        <CardDescription className="text-xs">
          ทดสอบความถูกต้องของเวอร์ชันพรอมต์จำลองกระบวนการจริง (OCR → AI Extract → RAG Prep)
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-5 space-y-6">
        <div className="flex flex-wrap items-center gap-4 border-b border-border/10 pb-4">
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">โครงการสำหรับสกัดบริบท</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
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
          <div className="flex-1 min-w-[200px] space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground">สัญญา (ถ้ามี)</Label>
            <Select value={selectedContract} onValueChange={setSelectedContract} disabled={!selectedProject}>
              <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
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
              <SelectTrigger className="h-8 text-xs bg-background/50 border-border/50">
                <SelectValue placeholder="เลือกเอนจิน..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs">Auto (Baseline)</SelectItem>
                <SelectItem value="tesseract" className="text-xs">Tesseract (CPU)</SelectItem>
                <SelectItem value="np-dms-ocr" className="text-xs">Typhoon OCR (GPU)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-background/40 p-4 border border-border/30 rounded-lg">
          <div className="flex items-center gap-3 flex-1">
            <div className="p-2 bg-primary/10 rounded">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">อัปโหลดไฟล์สำหรับทดสอบ Sandbox</Label>
              <p className="text-[10px] text-muted-foreground">เลือกไฟล์ PDF วิศวกรรม/ก่อสร้าง ขนาดไม่เกิน 50MB</p>
            </div>
          </div>
          <div className="relative overflow-hidden cursor-pointer bg-primary/90 hover:bg-primary/95 text-primary-foreground font-semibold px-4 py-2 rounded text-xs select-none flex items-center gap-2">
            <span>เลือกไฟล์เอกสาร...</span>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {file && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-secondary/20 border border-border/50 px-3 py-1.5 rounded">
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate flex-1">{file.name}</span>
            <span>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
          </div>
        )}

        {/* Status indicator */}
        {jobStatus === 'running' && (
          <div className="space-y-2.5 p-4 border border-primary/20 bg-primary/[0.02] rounded-lg">
            <div className="flex justify-between items-center text-xs">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Step buttons */}
          <div className="lg:col-span-3 flex lg:flex-col gap-2.5">
            <Button
              variant={currentStep === 1 ? 'default' : 'outline'}
              disabled={jobStatus === 'running' || !file}
              onClick={() => setCurrentStep(1)}
              className="w-full h-9 justify-start text-xs font-semibold"
            >
              <Badge className="mr-2 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] bg-secondary text-secondary-foreground select-none">1</Badge>
              Step 1: Run OCR
            </Button>
            <Button
              variant={currentStep === 2 ? 'default' : 'outline'}
              disabled={jobStatus === 'running' || !ocrText}
              onClick={() => setCurrentStep(2)}
              className="w-full h-9 justify-start text-xs font-semibold"
            >
              <Badge className="mr-2 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] bg-secondary text-secondary-foreground select-none">2</Badge>
              Step 2: AI Extract
            </Button>
            <Button
              variant={currentStep === 3 ? 'default' : 'outline'}
              disabled={jobStatus === 'running' || !extractedMetadata}
              onClick={() => setCurrentStep(3)}
              className="w-full h-9 justify-start text-xs font-semibold"
            >
              <Badge className="mr-2 h-4 min-w-4 px-1 flex items-center justify-center text-[9px] bg-secondary text-secondary-foreground select-none">3</Badge>
              Step 3: RAG Prep
            </Button>
          </div>

          {/* Step detail views */}
          <div className="lg:col-span-9 border border-border/30 rounded-lg p-4 bg-background/50 min-h-[300px] flex flex-col justify-between">
            {currentStep === 1 && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    Step 1: สกัดข้อความ OCR (OCR Extraction)
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    รันเอนจินสกัดข้อความเพื่อดึงตัวหนังสือดิบออกมาจากหน้าไฟล์ PDF ที่ส่งขึ้นไป สามารถดูผลลัพธ์ข้อความดิบเพื่อประเมินความคมชัดของ OCR
                  </p>
                </div>
                {ocrText ? (
                  <div className="flex-1 min-h-[150px] max-h-[250px] overflow-y-auto rounded bg-secondary/30 border border-border/50 p-3 font-mono text-[10px] whitespace-pre-wrap select-text leading-relaxed mt-3">
                    {ocrText}
                  </div>
                ) : (
                  <div className="flex-1 min-h-[150px] flex items-center justify-center border border-dashed border-border/70 rounded mt-3 text-xs text-muted-foreground italic">
                    ยังไม่มีข้อมูล OCR คลิก "เริ่มรัน OCR" ด้านล่าง
                  </div>
                )}
                <div className="flex justify-end pt-4 border-t border-border/10 mt-4">
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
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <FileJson className="h-4 w-4 text-primary" />
                    Step 2: สกัดข้อมูลอัจฉริยะ (AI Metadata Extraction)
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    ส่งข้อความ OCR พร้อมบริบท Master data (โครงการ/สัญญา) เข้าไปประมวลผลร่วมกับโมเดลหลักและเวอร์ชันพรอมต์ที่เลือก เพื่อแปลงเป็นโครงสร้างข้อมูล JSON อัจฉริยะ
                  </p>
                </div>
                {extractedMetadata ? (
                  <div className="flex-1 min-h-[150px] max-h-[250px] overflow-y-auto rounded bg-secondary/30 border border-border/50 p-3 font-mono text-[10px] text-emerald-400 select-text leading-relaxed mt-3">
                    <pre>{JSON.stringify(extractedMetadata, null, 2)}</pre>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[150px] flex items-center justify-center border border-dashed border-border/70 rounded mt-3 text-xs text-muted-foreground italic">
                    ยังไม่มีผลลัพธ์การสกัดข้อมูล คลิก "เริ่มรันสกัดข้อมูล" ด้านล่าง
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-border/10 mt-4">
                  {selectedVersionNumber && onActivateVersion && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleActivate}
                      className="h-8 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                    >
                      <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                      เปิดใช้งานเวอร์ชัน v{selectedVersionNumber} ทันที
                    </Button>
                  )}
                  <div className="flex-1 text-right">
                    <Button
                      size="sm"
                      onClick={handleRunExtract}
                      disabled={jobStatus === 'running' || !ocrText}
                      className="h-8 text-xs bg-primary hover:bg-primary/95 text-primary-foreground"
                    >
                      เริ่มรันสกัดข้อมูล (Run AI Extract)
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Database className="h-4 w-4 text-primary" />
                    Step 3: เตรียมฐานข้อมูลค้นหา (RAG Prep Sandbox)
                  </h4>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    จำลองกระบวนการแบ่งข้อความออกเป็นส่วนๆ (Semantic Chunking) ตามความเหมาะสมทางภาษาและความหมายของเอกสาร พร้อมแสดงขนาดเวกเตอร์ Dense/Sparse ที่สกัดสำหรับใช้ใน Qdrant
                  </p>
                </div>
                {ragChunks ? (
                  <div className="flex-1 flex flex-col gap-3 mt-3 overflow-hidden">
                    <div className="flex justify-between items-center bg-secondary/40 border border-border/50 px-3 py-2 rounded text-xs select-none">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                        ทำเวกเตอร์สำเร็จ: {ragVectorsCount} เวกเตอร์
                      </span>
                      <Badge variant="outline" className="text-[10px] border-border/50"> chunks: {ragChunks.length}</Badge>
                    </div>
                    <div className="flex-1 min-h-[120px] max-h-[200px] overflow-y-auto space-y-2 mt-1">
                      {ragChunks.map((chunk, idx) => (
                        <div key={idx} className="bg-background/80 border border-border/30 rounded p-2.5 text-[10px] space-y-1 hover:border-primary/20 transition-all select-text">
                          <div className="flex justify-between items-center text-primary font-bold">
                            <span>#Chunk {idx + 1}</span>
                            <Badge className="text-[8px] py-0 px-1 select-none">{chunk.summary || 'หัวข้อหลัก'}</Badge>
                          </div>
                          <p className="leading-relaxed text-muted-foreground">{chunk.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-[150px] flex items-center justify-center border border-dashed border-border/70 rounded mt-3 text-xs text-muted-foreground italic">
                    ยังไม่มีผลลัพธ์ RAG Prep คลิก "เริ่มทดสอบ RAG Prep" ด้านล่าง
                  </div>
                )}
                <div className="flex justify-end pt-4 border-t border-border/10 mt-4">
                  <Button
                    size="sm"
                    onClick={handleRunRagPrep}
                    disabled={jobStatus === 'running' || !ocrText}
                    className="h-8 text-xs bg-emerald-500 hover:bg-emerald-600 text-white"
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
  );
}
