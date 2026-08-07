// File: app/(dashboard)/migration/review/_components/attachment-list.tsx
// Change Log:
// - 2026-08-06: Initial creation — multi-attachment display with file type icons (Feature 242, FR-005, T043)

'use client';

import React from 'react';
import { FileText, FileImage, FileSpreadsheet, FileArchive, File, FileCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** ข้อมูล attachment ใน review queue response (FR-005) */
export interface AttachmentListItem {
  publicId: string;
  originalFilename: string;
  mimeType: string;
  hasOcrText: boolean;
  isMainDocument: boolean;
}

interface AttachmentListProps {
  attachments: AttachmentListItem[];
  className?: string;
}

/** ไอคอนตามประเภทไฟล์ */
const getFileIcon = (mimeType: string, filename: string) => {
  const lower = (filename || '').toLowerCase();
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return FileText;
  if (mimeType.startsWith('image/') || lower.endsWith('.dwg') || lower.endsWith('.dxf')) return FileImage;
  if (mimeType.includes('spreadsheet') || lower.endsWith('.xlsx') || lower.endsWith('.xls')) return FileSpreadsheet;
  if (mimeType.includes('zip') || lower.endsWith('.zip')) return FileArchive;
  if (mimeType.includes('word') || lower.endsWith('.docx') || lower.endsWith('.doc')) return FileCode;
  return File;
};

/** ป้ายประเภทไฟล์ภาษาไทย */
const getFileTypeLabel = (mimeType: string, filename: string): string => {
  const lower = (filename || '').toLowerCase();
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'PDF';
  if (lower.endsWith('.dwg')) return 'DWG';
  if (lower.endsWith('.dxf')) return 'DXF';
  if (mimeType.includes('spreadsheet') || lower.endsWith('.xlsx')) return 'Excel';
  if (mimeType.includes('zip') || lower.endsWith('.zip')) return 'ZIP';
  if (mimeType.includes('word') || lower.endsWith('.docx')) return 'Word';
  if (mimeType.startsWith('image/')) return 'รูปภาพ';
  return 'ไฟล์';
};

/**
 * แสดงรายการไฟล์แนบหลายไฟล์พร้อมไอคอนและสถานะ OCR (FR-005)
 * เอกสารหลัก (isMainDocument=true) จะแสดงป้าย "เอกสารหลัก"
 */
export function AttachmentList({ attachments, className }: AttachmentListProps) {
  if (!attachments || attachments.length === 0) {
    return (
      <div className={cn('text-sm text-muted-foreground py-2', className)}>
        ไม่มีไฟล์แนบ
      </div>
    );
  }
  return (
    <div className={cn('space-y-2', className)}>
      {attachments.map((att) => {
        const Icon = getFileIcon(att.mimeType, att.originalFilename);
        const typeLabel = getFileTypeLabel(att.mimeType, att.originalFilename);
        return (
          <div
            key={att.publicId}
            className="flex items-center gap-3 rounded-md border bg-card p-3 shadow-sm hover:bg-muted/30 transition-colors"
          >
            <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {att.originalFilename}
                </span>
                {att.isMainDocument && (
                  <Badge variant="default" className="text-xs flex-shrink-0">
                    เอกสารหลัก
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">{typeLabel}</span>
                {att.hasOcrText ? (
                  <Badge variant="outline" className="text-xs text-green-600 border-green-500/30">
                    มีข้อความ OCR
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-500/30">
                    ไม่มีข้อความ OCR
                  </Badge>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
