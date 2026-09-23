// File: components/migration/queue-doc-number.tsx
// Change Log:
// - 2026-09-24: Initial — แสดงเลขเอกสารฐาน + revision badge จาก details
//   (queue document_number เป็น staging key ตั้งแต่ revision-chain import —
//   เลขจริงอยู่ใน details.original_document_number / revision_label)

import { MigrationReviewQueueItem } from '@/types/migration';
import {
  getQueueBaseDocNumber,
  getQueueRevisionLabel,
} from '@/lib/utils/queue-doc-number';
import { Badge } from '@/components/ui/badge';

interface QueueDocNumberProps {
  item: Pick<MigrationReviewQueueItem, 'documentNumber' | 'details'>;
  /** ข้อความนำหน้า revision badge เช่น "ฉบับที่" / "Rev." */
  revisionPrefix?: string;
  className?: string;
}

/**
 * แสดงเลขที่เอกสารจริงของ migration queue item พร้อม revision badge
 * staging key (documentNumber) แสดงเป็น tooltip เมื่อต่างจากเลขจริง
 */
export function QueueDocNumber({
  item,
  revisionPrefix = 'Rev.',
  className,
}: QueueDocNumberProps) {
  const base = getQueueBaseDocNumber(item);
  const rev = getQueueRevisionLabel(item);
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className ?? ''}`}
      title={item.documentNumber !== base ? item.documentNumber : undefined}
    >
      <span>{base}</span>
      {rev !== undefined && (
        <Badge
          variant="outline"
          className="font-mono text-[10px] px-1 py-0 border-indigo-500/40 text-indigo-500"
        >
          {revisionPrefix} {rev}
        </Badge>
      )}
    </span>
  );
}
