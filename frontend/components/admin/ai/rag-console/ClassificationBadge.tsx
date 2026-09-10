// File: frontend/components/admin/ai/rag-console/ClassificationBadge.tsx
// Change Log:
// - 2026-09-10: T015 — สร้าง ClassificationBadge component สำหรับ Feature 255

import { Badge } from '@/components/ui/badge';

/** ระดับ security classification */
export type SecurityClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';

/** Map classification → Badge variant */
const CLASSIFICATION_VARIANT: Record<SecurityClassification, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  PUBLIC: 'outline',
  INTERNAL: 'secondary',
  CONFIDENTIAL: 'destructive',
};

/** Badge แสดง security classification */
export function ClassificationBadge({ classification }: { classification: SecurityClassification }) {
  return (
    <Badge variant={CLASSIFICATION_VARIANT[classification]}>
      {classification}
    </Badge>
  );
}
