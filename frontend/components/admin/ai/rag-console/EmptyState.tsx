// File: frontend/components/admin/ai/rag-console/EmptyState.tsx
// Change Log:
// - 2026-09-10: T017 — สร้าง EmptyState component สำหรับ Feature 255 (Q41)

import { Inbox } from 'lucide-react';
import { ragAdminT } from './rag-admin-i18n';

/** Props สำหรับ EmptyState — รับ i18n keys */
export interface EmptyStateProps {
  /** i18n key สำหรับ title (ภายใต้ rag.admin.* namespace) */
  titleKey: string;
  /** i18n key สำหรับ suggestion (optional) */
  suggestionKey?: string;
}

/** Empty state สำหรับ tab ต่าง ๆ (Q41 — contextual empty states)
 * ใช้ i18n keys จาก rag.admin.{tab}.empty_state.*
 */
export function EmptyState({ titleKey, suggestionKey }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
      <p className="text-sm font-medium text-muted-foreground">
        {ragAdminT(titleKey)}
      </p>
      {suggestionKey && (
        <p className="mt-1 text-xs text-muted-foreground/70">
          {ragAdminT(suggestionKey)}
        </p>
      )}
    </div>
  );
}
