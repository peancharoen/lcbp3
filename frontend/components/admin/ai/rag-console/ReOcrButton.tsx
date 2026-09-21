// File: frontend/components/admin/ai/rag-console/ReOcrButton.tsx
// Change Log:
// - 2026-09-19: ADR-055 T027 — ปุ่ม Re-OCR ต่อ row ใน RAG console (เห็นเฉพาะ rag.admin.write, เฉพาะ PDF)
// - 2026-09-19: ADR-055 D19/D22 — ปุ่ม "เปลี่ยนไฟล์" (ต้องมี rag.admin.write + correspondence.edit)

'use client';

import { useState } from 'react';
import { FileInput, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ReOcrDialog } from './ReOcrDialog';
import { useRagAdminT } from './rag-admin-i18n';

export interface ReOcrButtonProps {
  attachmentPublicId: string;
  originalFilename: string;
  mimeType: string;
}

/** ปุ่มเปิด ReOcrDialog — ซ่อนถ้าไม่มีสิทธิ์ rag.admin.write หรือไฟล์ไม่ใช่ PDF (engine รองรับ PDF เท่านั้น) */
export function ReOcrButton({ attachmentPublicId, originalFilename, mimeType }: ReOcrButtonProps) {
  const t = useRagAdminT();
  const canReOcr = useAuthStore((s) => s.hasPermission('rag.admin.write'));
  const canReplace = useAuthStore(
    (s) => s.hasPermission('rag.admin.write') && s.hasPermission('correspondence.edit')
  );
  const [open, setOpen] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  if (!canReOcr || mimeType !== 'application/pdf') return null;
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} title={t('re_ocr.action_hint')}>
        <ScanText className="h-4 w-4" />
        {t('re_ocr.action')}
      </Button>
      {canReplace && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReplaceOpen(true)}
          title={t('re_ocr.replace.action_hint')}
        >
          <FileInput className="h-4 w-4" />
          {t('re_ocr.replace.action')}
        </Button>
      )}
      {open && (
        <ReOcrDialog
          attachmentPublicId={attachmentPublicId}
          originalFilename={originalFilename}
          open={open}
          onOpenChange={setOpen}
        />
      )}
      {replaceOpen && (
        <ReOcrDialog
          attachmentPublicId={attachmentPublicId}
          originalFilename={originalFilename}
          open={replaceOpen}
          onOpenChange={setReplaceOpen}
          replaceEnabled
        />
      )}
    </>
  );
}
