// File: frontend/components/admin/ai/rag-console/RetryButton.tsx
// Change Log:
// - 2026-09-10: T059 — สร้าง RetryButton component สำหรับ Feature 255

import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ragAdminT } from './rag-admin-i18n';

/** Props สำหรับ RetryButton */
export interface RetryButtonProps {
  /** จำนวนรายการที่เลือก */
  selectedCount: number;
  /** กำลังประมวลผลอยู่หรือไม่ */
  isPending: boolean;
  /** Callback เมื่อคลิก retry */
  onClick: () => void;
}

/** Reusable retry button with disabled state while processing */
export function RetryButton({ selectedCount, isPending, onClick }: RetryButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={selectedCount === 0 || isPending}
    >
      <RotateCcw className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
      {selectedCount > 0
        ? ragAdminT('retry.retry_selected')
        : ragAdminT('retry.retry_all')}
      {selectedCount > 0 && ` (${selectedCount})`}
    </Button>
  );
}
