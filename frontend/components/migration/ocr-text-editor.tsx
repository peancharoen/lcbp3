// File: frontend/components/migration/ocr-text-editor.tsx
// Change Log:
// - 2026-08-20: สร้าง OCR Text Editor และปุ่ม Re-embed ลง Qdrant RAG (ADR-042/047)
// - 2026-08-23: RAG embedding เกิดขึ้นหลัง Execute Import เท่านั้น — ลบปุ่ม Pre-import re-embed

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileTextIcon, SaveIcon } from 'lucide-react';
import { migrationService } from '@/lib/services/migration.service';
import { v4 as uuidv4 } from 'uuid';

interface OcrTextEditorProps {
  publicId: string;
  initialOcrText?: string | null;
  onSaved?: (newText: string) => void;
}

export function OcrTextEditor({ publicId, initialOcrText, onSaved }: OcrTextEditorProps) {
  const [ocrText, setOcrText] = useState(initialOcrText || '');
  const [saving, setSaving] = useState(false);

  // Sync เมื่อ parent ส่ง initialOcrText ใหม่หลังจาก refetch (เช่น โหลด queue item ใหม่)
  useEffect(() => {
    setOcrText(initialOcrText || '');
  }, [initialOcrText]);

  // ADR-042/047: RAG embedding เกิดขึ้นหลัง Execute Import สำเร็จแล้ว
  // หน้า Review ใช้ปุ่มนี้แก้ไข OCR text สำหรับ import ไม่ใช่ re-embed staging
  const handleSaveOcr = async () => {
    if (!publicId) {
      toast.error('ไม่พบ publicId ของเอกสาร');
      return;
    }

    try {
      setSaving(true);
      // ADR-016: ส่ง Idempotency-Key สำหรับ OCR update mutation
      const idempotencyKey = `ocr-${publicId}-${uuidv4()}`;
      await migrationService.updateQueueOcr(
        publicId,
        { ocrText, reEmbed: false },
        idempotencyKey
      );
      toast.success('บันทึกข้อความ OCR เรียบร้อยแล้ว (RAG จะเกิดขึ้นหลัง Execute Import)');

      if (onSaved) {
        onSaved(ocrText);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการบันทึก OCR Text';
      toast.error(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/20 shadow-sm mt-4 bg-muted/10">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileTextIcon className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">ข้อความ OCR 3 หน้าแรก (ADR-042/047)</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">{ocrText.length} ตัวอักษร</span>
        </div>
        <CardDescription className="text-xs">
          ท่านสามารถตรวจทานและแก้ไขคำผิดของข้อความ OCR ได้ ระบบจะเก็บข้อความไว้สำหรับ Execute Import และ RAG จะเกิดขึ้นหลังจากนำเข้าสู่ระบบแล้ว
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          placeholder="ไม่มีข้อความ OCR สำหรับเอกสารนี้ (หรือยังไม่ได้ประมวลผล)"
          rows={6}
          disabled={saving}
          className="font-mono text-xs leading-relaxed bg-background"
        />

        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSaveOcr}
            disabled={saving}
            className="text-xs"
          >
            <SaveIcon className="h-3.5 w-3.5 mr-1" />
            {saving ? 'กำลังบันทึก...' : 'บันทึกข้อความ OCR'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
