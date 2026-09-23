// File: components/migration/queue-file-cell.tsx
// Change Log:
// - 2026-09-24: Initial — cell แสดงชื่อไฟล์ต้นฉบับ + สถานะพบ/ไม่พบไฟล์
//   สำหรับ Legacy Review Queue (attachments จาก details.attachments)

import { MigrationReviewQueueItem } from '@/types/migration';
import {
  getQueueAttachments,
  getQueueFileName,
  hasQueueFile,
} from '@/lib/utils/queue-file';
import { Badge } from '@/components/ui/badge';
import { FileCheck2, FileX2 } from 'lucide-react';

interface QueueFileCellProps {
  item: Pick<
    MigrationReviewQueueItem,
    'details' | 'originalFilename' | 'storageTempPath'
  >;
  /** ข้อความ badge เมื่อไม่พบไฟล์ */
  notFoundText?: string;
}

/**
 * แสดงชื่อไฟล์ต้นฉบับของ queue item + สถานะว่าพบไฟล์หรือไม่
 * - พบ: icon เขียว + ชื่อไฟล์ (+N เมื่อมีหลายไฟล์, tooltip แสดงชื่อทั้งหมด)
 * - ไม่พบแต่มีชื่อที่ register อ้างถึง: badge แดง + ชื่อที่คาดไว้ (จาง)
 * - ไม่มีข้อมูลไฟล์เลย: —
 */
export function QueueFileCell({
  item,
  notFoundText = 'ไม่พบไฟล์',
}: QueueFileCellProps) {
  const attachments = getQueueAttachments(item);
  const found = hasQueueFile(item);
  const name = getQueueFileName(item);

  if (!found) {
    if (!name) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    return (
      <span className="flex items-center gap-1.5 max-w-[220px]" title={name}>
        <Badge
          variant="outline"
          className="shrink-0 text-red-600 border-red-500/30 bg-red-500/5"
        >
          <FileX2 className="h-3 w-3 mr-1" />
          {notFoundText}
        </Badge>
        <span className="text-xs text-muted-foreground truncate">{name}</span>
      </span>
    );
  }

  const allNames = attachments
    .map((a) => a.originalFilename)
    .filter((n): n is string => typeof n === 'string' && n !== '')
    .join('\n');
  return (
    <span
      className="flex items-center gap-1.5 max-w-[220px]"
      title={allNames || name}
    >
      <FileCheck2 className="h-4 w-4 shrink-0 text-green-600" />
      <span className="text-xs truncate">{name}</span>
      {attachments.length > 1 && (
        <Badge variant="secondary" className="shrink-0 text-[10px] px-1 py-0">
          +{attachments.length - 1}
        </Badge>
      )}
    </span>
  );
}
