// File: frontend/components/admin/ai/AiExtractionPromptTab.tsx
// Change Log
// - 2026-06-17: Created AiExtractionPromptTab for AI extraction prompt management (Feature 238)
// - 2026-06-18: Fixed linting errors (no-console, no-unused-vars, no-explicit-any)

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { adminAiPromptService, AiPromptVersion } from '@/lib/services/admin-ai-prompt.service';
import PromptVersionHistory from './PromptVersionHistory';
import { RefreshCw, Save, AlertCircle } from 'lucide-react';
import { AiPrompt } from '@/types/ai-prompts';

/**
 * Component สำหรับจัดการ AI Extraction Prompt
 * - แสดง version history
 * - แก้ไข template (ต้องมี {{ocr_text}} placeholder)
 * - บันทึก version ใหม่
 * - เปิดใช้งาน version ที่ต้องการ
 */
export function AiExtractionPromptTab() {
  const [versions, setVersions] = useState<AiPromptVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<AiPromptVersion | null>(null);
  const [newTemplate, setNewTemplate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRefreshDialog, setShowRefreshDialog] = useState(false);

  const loadVersions = async () => {
    try {
      const data = await adminAiPromptService.getPrompts('ocr_extraction');
      setVersions(data);
      const active = data.find((v) => v.isActive);
      setActiveVersion(active || null);
      setNewTemplate(active?.template || '');
      setError(null);
    } catch {
      setError('Failed to load prompt versions');
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleSaveNewVersion = async () => {
    if (!newTemplate.trim()) {
      setError('Template cannot be empty');
      return;
    }

    if (!newTemplate.includes('{{ocr_text}}')) {
      setError('Template must include {{ocr_text}} placeholder');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await adminAiPromptService.createPrompt('ocr_extraction', newTemplate);
      await loadVersions();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        setShowRefreshDialog(true);
        setError('Version conflict - data was modified by another user');
      } else {
        setError('Failed to save new version');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleActivate = async (versionNumber: number) => {
    const version = versions.find(v => v.versionNumber === versionNumber);
    setIsActivating(true);
    setError(null);
    try {
      await adminAiPromptService.activatePrompt('ocr_extraction', versionNumber, version?.version);
      await loadVersions();
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('409')) {
        setShowRefreshDialog(true);
        setError('Version conflict - data was modified by another user');
      } else {
        setError('Failed to activate version');
      }
    } finally {
      setIsActivating(false);
    }
  };

  const handleDelete = async (versionNumber: number) => {
    setIsDeleting(true);
    setError(null);
    try {
      await adminAiPromptService.deletePrompt('ocr_extraction', versionNumber);
      await loadVersions();
    } catch {
      setError('Failed to delete version');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLoadTemplate = (version: AiPromptVersion) => {
    setNewTemplate(version.template);
  };

  const handleRefresh = () => {
    setShowRefreshDialog(false);
    loadVersions();
  };

  return (
    <div className="space-y-6">
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>AI Extraction Prompt Editor</CardTitle>
          <CardDescription>
            Extraction prompt สำหรับ LLM - ต้องมี {"{{ocr_text}}"} placeholder
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Template</label>
            <Textarea
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="Enter extraction prompt template with {{ocr_text}} placeholder..."
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Template ต้องมี {"{{ocr_text}}"} placeholder สำหรับแทนที่ข้อความ OCR
            </p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {activeVersion && (
                <Badge variant="outline">
                  Active: v{activeVersion.versionNumber}
                </Badge>
              )}
            </div>
            <Button
              onClick={handleSaveNewVersion}
              disabled={isSaving || !newTemplate.trim()}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save New Version
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
          <CardDescription>
            ประวัติเวอร์ชันทั้งหมดของ AI Extraction Prompt
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PromptVersionHistory
            versions={versions as unknown as AiPrompt[]}
            isLoading={false}
            onLoadTemplate={handleLoadTemplate as unknown as (version: AiPrompt) => void}
            onActivateVersion={handleActivate}
            onDeleteVersion={handleDelete}
            isActivating={isActivating}
            isDeleting={isDeleting}
          />
        </CardContent>
      </Card>

      {showRefreshDialog && (
        <Card className="border-warning">
          <CardHeader>
            <CardTitle className="text-warning">Data Modified</CardTitle>
            <CardDescription>
              ข้อมูลถูกแก้ไขโดยผู้ใช้อื่น กรุณารีเฟรชข้อมูล
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh}>Refresh Data</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
