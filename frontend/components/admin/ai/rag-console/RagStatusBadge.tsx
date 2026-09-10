// File: frontend/components/admin/ai/rag-console/RagStatusBadge.tsx
// Change Log:
// - 2026-09-10: T014 — สร้าง RagStatusBadge component สำหรับ Feature 255

import { Badge } from '@/components/ui/badge';
import { ragAdminT } from './rag-admin-i18n';

/** สถานะ RAG ingestion ที่แสดงใน dashboard (actual enum — Q5) */
export type RagStatus = 'NOT_STARTED' | 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';

/** Map status → Badge variant */
const STATUS_VARIANT: Record<RagStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning'> = {
  NOT_STARTED: 'outline',
  BUILDING: 'secondary',
  ACTIVE: 'success',
  RETIRED: 'warning',
  FAILED: 'destructive',
};

/** Badge แสดงสถานะ RAG ingestion (actual enum — Q5) */
export function RagStatusBadge({ status }: { status: RagStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {ragAdminT(`status.${status}`)}
    </Badge>
  );
}
