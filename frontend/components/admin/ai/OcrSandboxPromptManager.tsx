// File: frontend/components/admin/ai/OcrSandboxPromptManager.tsx
// Change Log
// - 2026-05-25: Created OcrSandboxPromptManager component for dynamic prompt editing, version control, and sandbox testing (ADR-029)
// - 2026-05-25: Extracted inline strings to i18n keys via useTranslations() (Obs #1 fix)
// - 2026-05-25: Refactored sandbox polling to useSandboxRun hook (Obs #2 fix)
// - 2026-05-26: เพิ่มการตรวจสอบ versionsQuery.data แบบทนทานเพื่อป้องกัน Error N.find is not a function ในกรณีที่ API ส่งข้อมูลแบบ wrapped object มา
// - 2026-05-29: เพิ่ม OCR Raw Text section ในผล sandbox
'use client';

import React, { useState, useEffect } from 'react';
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
import PromptVersionHistory from './PromptVersionHistory';
import { cn } from '@/lib/utils';
import { AiPrompt } from '@/types/ai-prompts';

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
  const activePrompt = versions.find((v) => Boolean(v.isActive));
  const [templateText, setTemplateText] = useState<string>('');
  const [ocrFile, setOcrFile] = useState<File | null>(null);
  const [manualNote, setManualNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'editor' | 'sandbox'>('editor');
  const { state: sandboxState, jobId: sandboxJobId, submit: submitSandbox, reset: resetSandbox } =
    useSandboxRun(() => {
      // เมื่อ sandbox เสร็จสิ้น: รีเฟรชรายการเวอร์ชัน
      versionsQuery.refetch();
      toast.success(t('ai.prompt.sandboxSuccess'));
    });
  useEffect(() => {
    if (activePrompt && !templateText) {
      setTemplateText(activePrompt.template);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePrompt]);
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
  const handleSubmitOcr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePrompt) {
      toast.error(t('ai.prompt.noActivePrompt'));
      return;
    }
    if (!ocrFile) {
      toast.error(t('ai.prompt.noFile'));
      return;
    }
    try {
      resetSandbox();
      await submitSandbox(ocrFile);
      toast.success(t('ai.prompt.uploadSuccess'));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || t('ai.prompt.uploadError'));
    }
  };
  // แปล status key เป็นข้อความตาม locale ปัจจุบัน
  const statusLabel = sandboxState.statusText ? t(sandboxState.statusText) : '';
  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start">
      <div className="lg:col-span-8 space-y-6">
        <div className="flex border-b border-border/20">
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
                  {t('ai.prompt.sandboxCardDesc')}
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitOcr} className="space-y-4">
                  <div className="space-y-2">
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
                      disabled={sandboxState.isRunning || !ocrFile || !activePrompt}
                      className="flex items-center gap-2"
                    >
                      {sandboxState.isRunning ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t('ai.prompt.running')}
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          {t('ai.prompt.runSandbox')}
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            {sandboxState.isRunning && (
              <Card className="border border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-500" />
                      {statusLabel}
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
            {sandboxState.result && sandboxState.result.status === 'completed' && (
              <div className="space-y-6">
                <Card className="border border-blue-500/20 bg-background/50 backdrop-blur-md">
                  <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-blue-600 dark:text-blue-400 flex items-center gap-2">
                      <ScanText className="h-4 w-4" />
                      OCR Raw Text
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">
                      {sandboxState.result.ocrUsed ? 'PaddleOCR' : 'Fast Path (Text Layer)'}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="relative rounded-md bg-muted p-4 font-mono text-xs overflow-auto max-h-[200px] border border-border/10">
                      <pre className="text-blue-600 dark:text-blue-400 select-text leading-relaxed whitespace-pre-wrap">
                        {sandboxState.result.ocrText || '(ไม่มีข้อความ)'}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-background/50 backdrop-blur-md">
                  <CardHeader className="border-b border-border/30 pb-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-base text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <FileJson className="h-4 w-4" />
                      {t('ai.prompt.resultTitle')}
                    </CardTitle>
                    {activePrompt && (
                      <Badge variant="outline" className="text-xs text-emerald-500 border-emerald-500/20 bg-emerald-500/5">
                        {t('ai.prompt.resultVersionBadge', { version: String(activePrompt.versionNumber) })}
                      </Badge>
                    )}
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
