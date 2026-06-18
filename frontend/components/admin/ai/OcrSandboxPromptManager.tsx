// File: frontend/components/admin/ai/OcrSandboxPromptManager.tsx
// Change Log
// - 2026-05-25: Created OcrSandboxPromptManager component for dynamic prompt editing, version control, and sandbox testing (ADR-029)
// - 2026-05-25: Extracted inline strings to i18n keys via useTranslations() (Obs #1 fix)
// - 2026-05-25: Refactored sandbox polling to useSandboxRun hook (Obs #2 fix)
// - 2026-05-26: เพิ่มการตรวจสอบ versionsQuery.data แบบทนทานเพื่อป้องกัน Error N.find is not a function
// - 2026-05-29: เพิ่ม OCR Raw Text section ในผล sandbox
// - 2026-05-29: ปรับปรุงการโหลด Active Prompt ให้ทนทานต่อ race conditions และรูปแบบประเภทข้อมูล
// - 2026-05-30: Refactor เป็น 2-step flow (Step 1: OCR-only → Step 2: AI Extraction) ตาม spec 231
// - 2026-06-02: ปรับปรุงลำดับปุ่มแท็บเริ่มต้นให้เริ่มที่ OCR Sandbox และเปลี่ยน dropdown labels ของ Typhoon OCR
// - 2026-06-04: เปลี่ยน OCR Engine dropdown จาก hardcoded เป็น dynamic โดยดึงจาก getOcrEngines() API
// - 2026-06-04: เพิ่ม UI sliders (temperature/topP/repeatPenalty) สำหรับ OCR engine
// - 2026-06-13: ADR-036 — เปลี่ยน sandbox OCR engine key เป็น np-dms-ocr
// - 2026-06-13: T030 — เพิ่ม Sandbox Parameter Panel สำหรับ tuning production profile draft
// - 2026-06-13: T044-T045 — เพิ่มปุ่ม Apply to Production และแสดงผลแผงพารามิเตอร์ของระบบ Production แบบอ่านอย่างเดียว
// - 2026-06-13: US4 — เพิ่ม project/contract selectors สำหรับ sandbox context parity
// - 2026-06-13: US5 — เพิ่มลิงก์สลับไปยังหน้าจัดการ Prompt Version (Editor tab) จากส่วนเลือกเวอร์ชันใน Sandbox
// - 2026-06-13: US9 — แก้ไข ESLint errors: ลบ parseInt และแก้ไข unsafe any type casting ของ projects/contracts
// - 2026-06-17: ADR-036 Gap 5 — แก้ไขให้ Step 1 (OCR) ไม่ต้องเลือก project (OCR เป็นแค่ text extraction); Step 2 (AI Extract) เท่านั้นที่ต้องเลือก project

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Brain,
  Save,
  AlertCircle,
  Upload,
  Play,
  FileJson,
  ScrollText,
  Loader2,
  StickyNote,
  ScanText,
} from 'lucide-react';
import { useAiPrompts, useSandboxRun } from '@/hooks/use-ai-prompts';
import { useTranslations } from '@/hooks/use-translations';
import { useProjects, useContracts } from '@/hooks/use-master-data';
import PromptVersionHistory from './PromptVersionHistory';
import { cn } from '@/lib/utils';
import { AiPrompt } from '@/types/ai-prompts';
import { adminAiService, OcrEngineResponse, SandboxProfileParams } from '@/lib/services/admin-ai.service';

interface SandboxProjectOption {
  publicId: string;
  projectCode: string;
  projectName: string;
}

interface SandboxContractOption {
  publicId: string;
  contractCode: string;
  contractName: string;
}

const DEFAULT_OCR_TEMPLATE = `คุณคือเอนจิ้นสกัดข้อมูลอัจฉริยะ (Document Intelligence Engine)
วิเคราะห์ข้อความ OCR ที่ได้รับจากเอกสารของโครงการ Laem Chabang Port Phase 3 และสกัดข้อมูลเมตาดาต้าให้ออกมาเป็น JSON object ที่ถูกต้องตามโครงสร้างที่กำหนด

ข้อความ OCR ที่สกัดได้:
{{ocr_text}}

ข้อมูลอ้างอิงของระบบ (Master Data Context):
{{master_data_context}}

กฎการสกัดข้อมูล:
1. วิเคราะห์และจับคู่ข้อมูลจากข้อความ OCR กับข้อมูลอ้างอิงที่ระบุใน Master Data Context เสมอ
2. สำหรับโครงการ (project) ให้ค้นหาและสกัดส่งกลับเป็น UUID ของโครงการ (projectPublicId)
3. สำหรับประเภทเอกสารโต้ตอบ (correspondence type) ให้สกัดรหัสส่งกลับมา (correspondenceTypeCode) เช่น RFA, Transmittal
4. สำหรับสาขางาน (discipline) ให้ส่งคืนรหัสส่งกลับมา (disciplineCode) เช่น GEN, STR
5. สำหรับหน่วยงานผู้ส่ง (originator) ค้นหาจาก availableOrganizations และส่งกลับมาเป็น UUID (originatorOrganizationPublicId)
6. สำหรับหน่วยงานผู้รับ (recipients) ให้ส่งกลับมาเป็นรายการ Array ของออบเจกต์ ซึ่งมี UUID ขององค์กร (organizationPublicId) และประเภทผู้รับ (recipientType: "TO" หรือ "CC") เสมอ
7. สำหรับหัวข้อเอกสาร (subject) ให้สกัดหัวข้อหรือชื่อเรื่องของเอกสารภาษาไทยหรือภาษาอังกฤษ
8. วันที่ของเอกสาร (documentDate) ให้ส่งคืนในรูปแบบ YYYY-MM-DD
9. รายการแท็ก (tags) สกัดคำสำคัญหรือคำแนะนำ Tags (สอดคล้องกับ availableTags หากมี)
10. สรุปความเนื้อหา (summary) เขียนสรุปรายละเอียดเอกสารสั้นกระชับ 4-5 ประโยคเป็นภาษาไทยอย่างสละสลวย
11. confidence: ค่าความมั่นใจในการสกัดข้อมูลนี้ (ทศนิยมระหว่าง 0.0 ถึง 1.0)

ส่งคืนคำตอบเฉพาะ JSON Object ที่ถูกต้องเท่านั้น ห้ามใส่บล็อกโค้ด markdown หรือคำอธิบายเพิ่มเติมใดๆ
โครงสร้าง JSON ผลลัพธ์:
{
  "projectPublicId": "string หรือ null",
  "correspondenceTypeCode": "string หรือ null",
  "disciplineCode": "string หรือ null",
  "originatorOrganizationPublicId": "string หรือ null",
  "recipients": [
    {
      "organizationPublicId": "string",
      "recipientType": "TO หรือ CC"
    }
  ],
  "subject": "string หรือ null",
  "documentDate": "string:YYYY-MM-DD หรือ null",
  "tags": ["string"],
  "summary": "string หรือ null",
  "confidence": 0.95
}`;

/**
 * Component หลักสำหรับจัดการ Prompt versions ของ OCR sandbox และ Migration
 * ประกอบไปด้วยตัวแก้ไข Prompt, รายการเวอร์ชัน, และส่วนสกัดทดสอบ (Sandbox run)
 */
export default function OcrSandboxPromptManager() {
  const t = useTranslations();
  const promptType = 'ocr_extraction';
  const {
    versionsQuery,
    createMutation,
    activateMutation,
    deleteMutation,
    updateNoteMutation,
  } = useAiPrompts(promptType);
  const versionsData = versionsQuery.data;
  const versions = Array.isArray(versionsData)
    ? versionsData
    : (versionsData && typeof versionsData === 'object' && 'data' in versionsData && Array.isArray((versionsData as { data: unknown }).data))
    ? (versionsData as { data: AiPrompt[] }).data
    : [];
  const activePrompt = versions.find(
    (v) => v.isActive === true || (v.isActive as unknown) === 1 || (v.isActive as unknown) === '1'
  ) || versions[0];
  const [templateText, setTemplateText] = useState<string>('');
  const [loadedPromptKey, setLoadedPromptKey] = useState<string | null>(null);
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [manualNote, setManualNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'sandbox'>('sandbox');
  // 2-step flow states
  const [sandboxStep, setSandboxStep] = useState<'ocr' | 'ai'>('ocr');
  const [selectedOcrEngine, setSelectedOcrEngine] = useState<string>('auto');
  const [typhoonTemperature, setTyphoonTemperature] = useState<number>(0.1);
  const [typhoonTopP, setTyphoonTopP] = useState<number>(0.1);
  const [typhoonRepeatPenalty, setTyphoonRepeatPenalty] = useState<number>(1.1);
  const { data: ocrEnginesData } = useQuery<OcrEngineResponse[]>({
    queryKey: ['ocr-engines'],
    queryFn: () => adminAiService.getOcrEngines(),
    staleTime: 60_000,
  });
  // --- Sandbox Parameter Panel state (T030, ADR-036) ---
  const [selectedModel, setSelectedModel] = useState<'np-dms-ai' | 'np-dms-ocr'>('np-dms-ai');
  const profileName = selectedModel === 'np-dms-ai' ? 'standard' : 'ocr-extract';
  const [sandboxParams, setSandboxParams] = useState<SandboxProfileParams | null>(null);
  const [sandboxParamsDraft, setSandboxParamsDraft] = useState<Partial<SandboxProfileParams>>({});
  const [isSavingParams, setIsSavingParams] = useState(false);
  const [isResettingParams, setIsResettingParams] = useState(false);
  const [showParamPanel, setShowParamPanel] = useState(false);

  // --- US4 states ---
  const [selectedProjectPublicId, setSelectedProjectPublicId] = useState<string>('');
  const [selectedContractPublicId, setSelectedContractPublicId] = useState<string>('');
  const { data: projectsData } = useProjects();
  const projects = Array.isArray(projectsData) ? (projectsData as SandboxProjectOption[]) : [];
  const { data: contractsData } = useContracts(selectedProjectPublicId);
  const contracts = Array.isArray(contractsData) ? (contractsData as SandboxContractOption[]) : [];

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectPublicId(projectId);
    setSelectedContractPublicId('');
  };

  // --- Phase 4 apply and production defaults states (T044, T045) ---
  const [prodParams, setProdParams] = useState<SandboxProfileParams | null>(null);
  const [isApplyingParams, setIsApplyingParams] = useState(false);

  const fetchProdParams = useCallback(async () => {
    try {
      const params = await adminAiService.getProductionDefaults(profileName);
      setProdParams(params);
    } catch {
      // Ignored
    }
  }, [profileName]);

  useEffect(() => {
    adminAiService.getSandboxProfile(profileName)
      .then((params) => {
        setSandboxParams(params);
        setSandboxParamsDraft({
          temperature: params.temperature,
          topP: params.topP,
          repeatPenalty: params.repeatPenalty,
          maxTokens: params.maxTokens,
          numCtx: params.numCtx,
          keepAliveSeconds: params.keepAliveSeconds,
        });
      })
      .catch(() => { /* ไม่ต้องแสดง error — อาจเป็น 403 หาก feature ยังไม่เปิด */ });

    fetchProdParams();
  }, [profileName, fetchProdParams]);

  const handleSaveParams = useCallback(async () => {
    setIsSavingParams(true);
    try {
      const key = `sandbox-params-${profileName}-${Date.now()}`;
      const updated = await adminAiService.saveSandboxProfile(profileName, sandboxParamsDraft, key);
      setSandboxParams(updated);
      toast.success('Sandbox parameters saved');
    } catch {
      toast.error('Failed to save sandbox parameters');
    } finally {
      setIsSavingParams(false);
    }
  }, [profileName, sandboxParamsDraft]);

  const handleApplyParams = useCallback(async () => {
    if (!confirm(`Are you sure you want to apply sandbox draft parameters for ${profileName} to production? This will immediately affect live production jobs.`)) {
      return;
    }
    setIsApplyingParams(true);
    try {
      const idempotencyKey = `apply-params-${profileName}-${Date.now()}`;
      await adminAiService.applyProfile(profileName, idempotencyKey);
      toast.success('Parameters successfully applied to production!');
      await fetchProdParams();
    } catch {
      toast.error('Failed to apply parameters to production');
    } finally {
      setIsApplyingParams(false);
    }
  }, [profileName, fetchProdParams]);

  const handleResetParams = useCallback(async () => {
    setIsResettingParams(true);
    try {
      const reset = await adminAiService.resetSandboxProfile(profileName);
      setSandboxParams(reset);
      setSandboxParamsDraft({
        temperature: reset.temperature,
        topP: reset.topP,
        repeatPenalty: reset.repeatPenalty,
        maxTokens: reset.maxTokens,
        numCtx: reset.numCtx,
        keepAliveSeconds: reset.keepAliveSeconds,
      });
      toast.success('Sandbox parameters reset to production values');
    } catch {
      toast.error('Failed to reset sandbox parameters');
    } finally {
      setIsResettingParams(false);
    }
  }, [profileName]);
  const ocrEngineOptions = useMemo(() => {
    const base = [{ value: 'auto', label: 'Auto (Current Baseline)' }];
    if (!ocrEnginesData) return base;
    const mapped = ocrEnginesData.map((e: OcrEngineResponse) => {
      const value =
        e.engineType === 'tesseract'
          ? 'tesseract'
          : e.engineType === 'typhoon_ocr'
          ? 'np-dms-ocr'
          : e.engineType;
      const vramLabel =
        e.vramRequirementMB > 0
          ? ` (${(e.vramRequirementMB / 1024).toFixed(1)} GB VRAM)`
          : '';
      const activeLabel = e.isCurrentActive ? ' ✓' : '';
      return { value, label: `${e.engineName}${vramLabel}${activeLabel}` };
    });
    return [...base, ...mapped];
  }, [ocrEnginesData]);
  const [ocrResult, setOcrResult] = useState<{
    requestPublicId: string;
    ocrText: string;
    ocrUsed: boolean;
    engineUsed?: string;
    fallbackUsed?: boolean;
  } | null>(null);
  const [selectedPromptVersion, setSelectedPromptVersion] = useState<number | undefined>(undefined);
  const { state: sandboxState, jobId: sandboxJobId, reset: resetSandbox, startPolling } =
    useSandboxRun(() => {
      // เมื่อ sandbox เสร็จสิ้น: รีเฟรชรายการเวอร์ชัน
      versionsQuery.refetch();
      toast.success(t('ai.prompt.sandboxSuccess'));
    });
  useEffect(() => {
    if (!versionsQuery.isSuccess) return;
    if (activePrompt) {
      const promptKey = `${activePrompt.promptType}:${activePrompt.versionNumber}`;
      if (loadedPromptKey !== promptKey) {
        setTemplateText(activePrompt.template);
        setLoadedPromptKey(promptKey);
      }
      return;
    }
    if (versions.length === 0 && loadedPromptKey === null) {
      setTemplateText(DEFAULT_OCR_TEMPLATE);
      setLoadedPromptKey('default');
    }
  }, [activePrompt, versions.length, versionsQuery.isSuccess, loadedPromptKey]);
  const handleSaveVersion = async () => {
    if (!templateText.includes('{{ocr_text}}')) {
      toast.error(t('ai.prompt.placeholderError'));
      return;
    }
    if (templateText.length > 4000) {
      toast.error(t('ai.prompt.charLimitError'));
      return;
    }
    try {
      await createMutation.mutateAsync(templateText);
      toast.success(t('ai.prompt.saveVersionSuccess'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.saveVersionError'));
    }
  };
  const handleLoadTemplate = (version: AiPrompt) => {
    setTemplateText(version.template);
    setActiveTab('editor');
    toast.success(t('ai.prompt.loadSuccess', { version: String(version.versionNumber) }));
  };
  const handleActivateVersion = async (versionNumber: number) => {
    try {
      await activateMutation.mutateAsync(versionNumber);
      toast.success(t('ai.prompt.activateSuccess', { version: String(versionNumber) }));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.activateError'));
    }
  };
  const handleDeleteVersion = async (versionNumber: number) => {
    if (!confirm(t('ai.prompt.deleteConfirm', { version: String(versionNumber) }))) return;
    try {
      await deleteMutation.mutateAsync(versionNumber);
      toast.success(t('ai.prompt.deleteSuccess', { version: String(versionNumber) }));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.deleteError'));
    }
  };
  const handleSaveManualNote = async (versionNumber: number) => {
    try {
      await updateNoteMutation.mutateAsync({ versionNumber, note: manualNote });
      toast.success(t('ai.prompt.saveNoteSuccess'));
      setManualNote('');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.saveNoteError'));
    }
  };
  // Step 1: OCR-only handler (ไม่ต้องเลือก project - OCR เป็นแค่ text extraction)
  const handleStep1Ocr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ocrFile) {
      toast.error(t('ai.prompt.noFile'));
      return;
    }
    try {
      resetSandbox();
      setSandboxStep('ocr');
      const typhoonOptions = selectedOcrEngine === 'np-dms-ocr'
        ? { temperature: typhoonTemperature, topP: typhoonTopP, repeatPenalty: typhoonRepeatPenalty }
        : undefined;
      const { requestPublicId } = await adminAiService.submitSandboxOcr(
        ocrFile,
        selectedOcrEngine,
        typhoonOptions
      );
      toast.success(t('ai.prompt.uploadSuccess'));
      // Poll สำหรับผลลัพธ์ OCR
      const pollInterval = setInterval(async () => {
        try {
          const result = await adminAiService.getSandboxJobStatus(requestPublicId);
          if (result.status === 'completed') {
            clearInterval(pollInterval);
            setOcrResult({
              requestPublicId,
              ocrText: result.ocrText || '',
              ocrUsed: result.ocrUsed || false,
              engineUsed: result.engineUsed,
              fallbackUsed: result.fallbackUsed,
            });
            setSandboxStep('ai');
            toast.success('OCR completed successfully');
          } else if (result.status === 'failed') {
            clearInterval(pollInterval);
            toast.error(result.errorMessage || 'OCR failed');
          }
        } catch (_err) {
          clearInterval(pollInterval);
          toast.error('Poll error occurred');
        }
      }, 1000);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.uploadError'));
    }
  };
  // Step 2: AI Extraction handler
  const handleStep2AiExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectPublicId) {
      toast.error('Please select a project first');
      return;
    }
    if (!ocrResult) {
      toast.error('Please run Step 1 (OCR) first');
      return;
    }
    if (!activePrompt) {
      toast.error(t('ai.prompt.noActivePrompt'));
      return;
    }
    try {
      resetSandbox();
      const { requestPublicId } = await adminAiService.submitSandboxAiExtract(
        ocrResult.requestPublicId,
        selectedPromptVersion,
        selectedProjectPublicId,
        selectedContractPublicId || undefined
      );
      toast.success('AI Extraction started');
      // เริ่ม polling ผ่าน useSandboxRun hook
      startPolling(requestPublicId);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'AI Extraction failed');
    }
  };
  // Reset 2-step flow
  const handleResetSandbox = () => {
    setSandboxStep('ocr');
    setOcrResult(null);
    setSelectedPromptVersion(undefined);
    setSelectedOcrEngine('auto');
    setTyphoonTemperature(0.1);
    setTyphoonTopP(0.1);
    setTyphoonRepeatPenalty(1.1);
    setOcrFile(null);
    setSelectedProjectPublicId('');
    setSelectedContractPublicId('');
    resetSandbox();
  };
  // แปล status key เป็นข้อความตาม locale ปัจจุบัน
  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      <div className="lg:col-span-8 space-y-6">
        <div className="flex border-b border-border/20">
          <button
            onClick={() => setActiveTab('sandbox')}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all',
              activeTab === 'sandbox'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t('ai.prompt.tabSandbox')}
          </button>
          <button
            onClick={() => setActiveTab('editor')}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 -mb-[2px] transition-all',
              activeTab === 'editor'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t('ai.prompt.tabEditor')}
          </button>
        </div>
        {activeTab === 'editor' ? (
          <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
            <CardHeader className="pb-3 flex flex-row justify-between items-center">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ScrollText className="h-4 w-4 text-primary" />
                {t('ai.prompt.cardTitle')}
              </CardTitle>
              {activePrompt && (
                <Badge variant="outline" className="text-xs">
                  {t('ai.prompt.activeLabel', { version: String(activePrompt.versionNumber) })}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Textarea
                  value={templateText}
                  onChange={(e) => setTemplateText(e.target.value)}
                  disabled={createMutation.isPending}
                  rows={15}
                  placeholder={t('ai.prompt.editorPlaceholder')}
                  className="font-mono text-xs leading-relaxed resize-none border border-input bg-background/30"
                />
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span className={cn(templateText.includes('{{ocr_text}}') ? 'text-emerald-500' : 'text-amber-500')}>
                    {templateText.includes('{{ocr_text}}')
                      ? t('ai.prompt.placeholderOk')
                      : t('ai.prompt.placeholderMissing')}
                  </span>
                  <span className={cn(templateText.length > 4000 ? 'text-destructive font-bold' : '')}>
                    {t('ai.prompt.charCount', { count: String(templateText.length) })}
                  </span>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveVersion}
                  disabled={createMutation.isPending || templateText.length === 0}
                  className="flex items-center gap-2"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {t('ai.prompt.saveVersion')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Upload className="h-4 w-4 text-primary" />
                  {t('ai.prompt.sandboxCardTitle')}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {sandboxStep === 'ocr'
                    ? 'Step 1: Upload PDF and run OCR to check quality'
                    : 'Step 2: Test AI prompt with OCR text'}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Project and Contract Selectors (US4) */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      Project <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={selectedProjectPublicId}
                      onChange={(e) => handleProjectChange(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      disabled={sandboxState.isRunning}
                    >
                      <option value="">-- Select Project --</option>
                      {projects.map((proj) => (
                        <option key={proj.publicId} value={proj.publicId}>
                          {proj.projectCode} - {proj.projectName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                      Contract
                    </label>
                    <select
                      value={selectedContractPublicId}
                      onChange={(e) => setSelectedContractPublicId(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                      disabled={sandboxState.isRunning || !selectedProjectPublicId}
                    >
                      <option value="">-- Select Contract (Optional) --</option>
                      {contracts.map((ctr) => (
                        <option key={ctr.publicId} value={ctr.publicId}>
                          {ctr.contractCode} - {ctr.contractName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border-t border-border/10 my-4" />

                {sandboxStep === 'ocr' ? (
                  <form onSubmit={handleStep1Ocr} className="space-y-4">
                    <div className="space-y-4">
                      {/* --- Sandbox Parameter Panel (T030) --- */}
                      {sandboxParams && (
                        <div className="rounded-md border border-border/30 bg-muted/10">
                          <button
                            type="button"
                            onClick={() => setShowParamPanel((v) => !v)}
                            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span>LLM Sandbox Parameters (production profile draft)</span>
                            <span className="text-[10px]">{showParamPanel ? '\u25b2' : '\u25bc'}</span>
                          </button>
                          {showParamPanel && (
                            <div className="px-3 pb-3 space-y-3 border-t border-border/20 pt-3">
                              <div className="space-y-1">
                                <label className="text-[10px] font-medium text-muted-foreground">Model Profile (T050)</label>
                                <select
                                  value={selectedModel}
                                  onChange={(e) => setSelectedModel(e.target.value as 'np-dms-ai' | 'np-dms-ocr')}
                                  className="w-full rounded border border-input bg-background px-2.5 py-1 text-xs"
                                >
                                  <option value="np-dms-ai">LLM Engine (np-dms-ai / standard)</option>
                                  <option value="np-dms-ocr">OCR Engine (np-dms-ocr / ocr-extract)</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="space-y-1">
                                  <div className="flex justify-between"><label>Temperature</label><span className="font-mono text-muted-foreground">{((sandboxParamsDraft.temperature ?? sandboxParams?.temperature) ?? 0).toFixed(2)}</span></div>
                                  <input type="range" min={0} max={1} step={0.01} value={(sandboxParamsDraft.temperature ?? sandboxParams?.temperature) ?? 0} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, temperature: parseFloat(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between"><label>Top-P</label><span className="font-mono text-muted-foreground">{((sandboxParamsDraft.topP ?? sandboxParams?.topP) ?? 0).toFixed(2)}</span></div>
                                  <input type="range" min={0} max={1} step={0.01} value={(sandboxParamsDraft.topP ?? sandboxParams?.topP) ?? 0} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, topP: parseFloat(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between"><label>Repeat Penalty</label><span className="font-mono text-muted-foreground">{((sandboxParamsDraft.repeatPenalty ?? sandboxParams?.repeatPenalty) ?? 1).toFixed(2)}</span></div>
                                  <input type="range" min={1} max={2} step={0.01} value={(sandboxParamsDraft.repeatPenalty ?? sandboxParams?.repeatPenalty) ?? 1} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, repeatPenalty: parseFloat(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                </div>
                                <div className="space-y-1">
                                  <div className="flex justify-between"><label>Keep-Alive (s)</label><span className="font-mono text-muted-foreground">{(sandboxParamsDraft.keepAliveSeconds ?? sandboxParams?.keepAliveSeconds) ?? 0}</span></div>
                                  <input type="range" min={0} max={3600} step={60} value={(sandboxParamsDraft.keepAliveSeconds ?? sandboxParams?.keepAliveSeconds) ?? 0} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, keepAliveSeconds: Number(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                </div>
                                {selectedModel === 'np-dms-ai' && (
                                  <>
                                    <div className="space-y-1">
                                      <div className="flex justify-between"><label>Max Tokens</label><span className="font-mono text-muted-foreground">{(sandboxParamsDraft.maxTokens ?? sandboxParams?.maxTokens) ?? 4096}</span></div>
                                      <input type="range" min={256} max={16384} step={256} value={(sandboxParamsDraft.maxTokens ?? sandboxParams?.maxTokens) ?? 4096} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, maxTokens: Number(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                    </div>
                                    <div className="space-y-1">
                                      <div className="flex justify-between"><label>Ctx Size</label><span className="font-mono text-muted-foreground">{(sandboxParamsDraft.numCtx ?? sandboxParams?.numCtx) ?? 8192}</span></div>
                                      <input type="range" min={1024} max={32768} step={1024} value={(sandboxParamsDraft.numCtx ?? sandboxParams?.numCtx) ?? 8192} onChange={(e) => setSandboxParamsDraft((p) => ({ ...p, numCtx: Number(e.target.value) }))} className="w-full h-1.5 accent-primary" />
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Production Defaults Read-Only Panel (T045) */}
                              {prodParams && (
                                <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs space-y-1">
                                  <p className="font-semibold text-emerald-600 dark:text-emerald-400">Current Production Parameters (Read-only)</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground font-semibold">
                                    <div>Model: {prodParams.canonicalModel}</div>
                                    <div>Temperature: {prodParams.temperature.toFixed(2)}</div>
                                    <div>Top-P: {prodParams.topP.toFixed(2)}</div>
                                    <div>Repeat Penalty: {prodParams.repeatPenalty.toFixed(2)}</div>
                                    <div>Keep-Alive: {prodParams.keepAliveSeconds}s</div>
                                    {prodParams.maxTokens !== null && <div>Max Tokens: {prodParams.maxTokens}</div>}
                                    {prodParams.numCtx !== null && <div>Ctx Size: {prodParams.numCtx}</div>}
                                  </div>
                                </div>
                              )}

                              <div className="flex justify-end gap-2 pt-1 flex-wrap">
                                <Button type="button" variant="outline" size="sm" disabled={isResettingParams} onClick={handleResetParams} className="text-xs h-7 px-3">
                                  {isResettingParams ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Reset to Production'}
                                </Button>
                                <Button type="button" variant="secondary" size="sm" disabled={isSavingParams} onClick={handleSaveParams} className="text-xs h-7 px-3">
                                  {isSavingParams ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save Draft'}
                                </Button>
                                <Button type="button" variant="destructive" size="sm" disabled={isApplyingParams} onClick={handleApplyParams} className="text-xs h-7 px-3 flex items-center gap-1">
                                  {isApplyingParams ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                  Apply to Production
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="space-y-2">
                        <label className="text-xs font-medium">OCR Engine</label>
                        <select
                          value={selectedOcrEngine}
                          onChange={(e) => setSelectedOcrEngine(e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs"
                        >
                           {ocrEngineOptions.map((opt) => (
                             <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
                        </select>
                      </div>
                      {selectedOcrEngine === 'np-dms-ocr' && (
                        <div className="space-y-3 rounded-md border border-dashed border-amber-500/30 bg-amber-500/5 p-3">
                          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Typhoon OCR Options <span className="font-normal text-muted-foreground">(override Modelfile defaults)</span></p>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <label>Temperature</label>
                              <span className="font-mono text-muted-foreground">{typhoonTemperature.toFixed(2)}</span>
                            </div>
                            <input type="range" min={0} max={1} step={0.01}
                              value={typhoonTemperature}
                              onChange={(e) => setTyphoonTemperature(parseFloat(e.target.value))}
                              className="w-full h-1.5 accent-amber-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <label>Top-P</label>
                              <span className="font-mono text-muted-foreground">{typhoonTopP.toFixed(2)}</span>
                            </div>
                            <input type="range" min={0} max={1} step={0.01}
                              value={typhoonTopP}
                              onChange={(e) => setTyphoonTopP(parseFloat(e.target.value))}
                              className="w-full h-1.5 accent-amber-500"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <label>Repeat Penalty</label>
                              <span className="font-mono text-muted-foreground">{typhoonRepeatPenalty.toFixed(2)}</span>
                            </div>
                            <input type="range" min={1} max={2} step={0.01}
                              value={typhoonRepeatPenalty}
                              onChange={(e) => setTyphoonRepeatPenalty(parseFloat(e.target.value))}
                              className="w-full h-1.5 accent-amber-500"
                            />
                          </div>
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex flex-col items-center justify-center rounded-lg border border-dashed p-8 transition-all',
                          ocrFile ? 'border-primary/50 bg-primary/5' : 'border-muted-foreground/20 hover:bg-muted/10'
                        )}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (sandboxState.isRunning) return;
                          const file = e.dataTransfer.files?.[0];
                          if (file?.name.toLowerCase().endsWith('.pdf')) {
                            setOcrFile(file);
                          } else {
                            toast.error(t('ai.prompt.dropzonePdfOnly'));
                          }
                        }}
                      >
                        <Brain className="h-9 w-9 text-muted-foreground/50 mb-2 animate-bounce" />
                        {ocrFile ? (
                          <div className="text-center space-y-1">
                            <p className="text-sm font-semibold">{ocrFile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              ({(ocrFile.size / 1024 / 1024).toFixed(2)} MB)
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={sandboxState.isRunning}
                              onClick={() => setOcrFile(null)}
                              className="mt-2 text-xs text-destructive hover:bg-destructive/10"
                            >
                              {t('ai.prompt.removeFile')}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-center space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {t('ai.prompt.dropzoneDrag')}
                            </p>
                            <input
                              type="file"
                              accept=".pdf"
                              disabled={sandboxState.isRunning}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) setOcrFile(file);
                              }}
                              className="hidden"
                              id="ocr-sandbox-file"
                            />
                            <label
                              htmlFor="ocr-sandbox-file"
                              className="mt-2.5 inline-flex h-8 items-center justify-center rounded-md bg-secondary px-3.5 text-xs font-semibold cursor-pointer hover:bg-secondary/85 transition-colors"
                            >
                              {t('ai.prompt.dropzoneChoose')}
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <Button
                        type="submit"
                        disabled={sandboxState.isRunning || !ocrFile}
                        className="flex items-center gap-2"
                      >
                        {sandboxState.isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running OCR...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Step 1: Run OCR Only
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleStep2AiExtract} className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium">Prompt Version:</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('editor')}
                            className="text-[10px] text-primary hover:underline font-semibold"
                          >
                            (Manage/Edit Prompts)
                          </button>
                        </div>
                        <select
                          value={selectedPromptVersion ?? (activePrompt?.versionNumber ?? '')}
                          onChange={(e) => setSelectedPromptVersion(e.target.value ? Number(e.target.value) : undefined)}
                          className="text-xs bg-background border border-input rounded px-2 py-1"
                        >
                          {versions.map((v) => (
                            <option key={v.versionNumber} value={v.versionNumber}>
                              Version {v.versionNumber} {v.isActive ? '(Active)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleResetSandbox}
                          className="text-xs"
                        >
                          Reset
                        </Button>
                        <Button
                          type="submit"
                          disabled={sandboxState.isRunning || !activePrompt || !selectedProjectPublicId}
                          className="flex items-center gap-2"
                        >
                          {sandboxState.isRunning ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Running AI...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              Step 2: Run AI Extraction
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
            {sandboxStep === 'ai' && ocrResult && (
              <Card className="border border-blue-500/20 bg-background/50 backdrop-blur-md">
                <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-blue-600 dark:text-blue-400 flex items-center gap-2">
                    <ScanText className="h-4 w-4" />
                    OCR Raw Text (Step 1 Result)
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {ocrResult.engineUsed === 'np-dms-ocr'
                      ? 'np-dms-ocr'
                      : ocrResult.ocrUsed
                        ? 'Tesseract'
                        : 'Fast Path (Text Layer)'}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  {ocrResult.fallbackUsed && (
                    <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-400">
                      np-dms-ocr unavailable. Fallback to Tesseract was used for this run.
                    </div>
                  )}
                  <div className="relative rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[200px] border border-border/10">
                    <pre className="text-blue-600 dark:text-blue-400 select-text leading-relaxed whitespace-pre-wrap">
                      {ocrResult.ocrText || '(ไม่มีข้อความ)'}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
            {sandboxState.result && sandboxState.result.llmPrompt && (
              <Card className="border border-purple-500/20 bg-purple-500/5">
                <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base text-purple-600 dark:text-purple-400 flex items-center gap-2">
                    <StickyNote className="h-4 w-4" />
                    LLM Prompt (Step 2 Input)
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {sandboxState.result.llmPrompt.length} chars
                  </Badge>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="relative rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[300px] border border-border/10">
                    <pre className="text-purple-600 dark:text-purple-400 select-text leading-relaxed whitespace-pre-wrap">
                      {sandboxState.result.llmPrompt}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            )}
            {sandboxState.isRunning && (
              <Card className="border border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      {sandboxStep === 'ocr' ? 'Running OCR...' : 'Running AI Extraction...'}
                    </span>
                    <span>{sandboxState.progress}%</span>
                  </div>
                  <Progress value={sandboxState.progress} className="h-1.5" />
                  <div className="text-[10px] text-muted-foreground font-mono bg-background/50 p-2 rounded">
                    Request ID: {sandboxJobId}
                  </div>
                </CardContent>
              </Card>
            )}
            {sandboxState.result && sandboxState.result.status === 'completed' && sandboxStep === 'ai' && (
              <div className="space-y-6">
                <Card className="border border-emerald-500/20 bg-background/50 backdrop-blur-md">
                  <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      {t('ai.prompt.resultTitle')}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                      Version {sandboxState.result.promptVersionUsed || (activePrompt?.versionNumber ?? '?')}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="relative rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[300px] border border-border/10">
                      <pre className="text-emerald-600 dark:text-emerald-400 select-text leading-relaxed">
                        {sandboxState.result.answer}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
                {activePrompt && (
                  <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-amber-500 animate-pulse" />
                        {t('ai.prompt.noteCardTitle')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={manualNote}
                        onChange={(e) => setManualNote(e.target.value)}
                        placeholder={t('ai.prompt.notePlaceholder')}
                        rows={3}
                        className="text-xs leading-relaxed resize-none bg-background/30"
                      />
                      <div className="flex justify-end">
                        <Button
                          disabled={updateNoteMutation.isPending || !manualNote.trim()}
                          onClick={() => handleSaveManualNote(activePrompt.versionNumber)}
                          className="flex items-center gap-2 text-xs"
                          size="sm"
                        >
                          {updateNoteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          {t('ai.prompt.saveNote', { version: String(activePrompt.versionNumber) })}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
            {sandboxState.result && sandboxState.result.status === 'failed' && (
              <Card className="border border-destructive/20 bg-destructive/5">
                <CardHeader className="flex flex-row items-center gap-2 pb-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium">{t('ai.prompt.sandboxErrorTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {sandboxState.result.errorMessage || t('ai.prompt.sandboxErrorDefault')}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
      <div className="lg:col-span-4">
        <PromptVersionHistory
          versions={versions}
          isLoading={versionsQuery.isLoading}
          onLoadTemplate={handleLoadTemplate}
          onActivateVersion={handleActivateVersion}
          onDeleteVersion={handleDeleteVersion}
          isActivating={activateMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      </div>
    </div>
  );
}
