// File: frontend/components/admin/ai/rag-console/GenerationTimeline.tsx
// Change Log:
// - 2026-09-10: T040 — สร้าง GenerationTimeline component สำหรับ Feature 255

import { ragAdminT } from './rag-admin-i18n';
import { RagStatusBadge, type RagStatus } from './RagStatusBadge';

/** Item ใน generation timeline (ไม่มี generationUuid — FR-014) */
export interface GenerationTimelineItem {
  status: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
  chunkCount: number;
  createdAt: string;
  activatedAt: string | null;
  retiredAt: string | null;
  failedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}

/** Timeline component แสดง generation lifecycle history (newest first — Q25) */
export function GenerationTimeline({ generations }: { generations: GenerationTimelineItem[] }) {
  if (generations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {generations.map((gen, index) => (
        <div key={index} className="rounded-md border p-4">
          <div className="flex items-center justify-between">
            <RagStatusBadge status={gen.status as RagStatus} />
            <span className="text-xs text-muted-foreground">
              {new Date(gen.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.chunk_count')}:</span>{' '}
              {gen.chunkCount}
            </div>
            {gen.activatedAt && (
              <div>
                <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.activated_at')}:</span>{' '}
                {new Date(gen.activatedAt).toLocaleString()}
              </div>
            )}
            {gen.retiredAt && (
              <div>
                <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.retired_at')}:</span>{' '}
                {new Date(gen.retiredAt).toLocaleString()}
              </div>
            )}
            {gen.failedAt && (
              <div>
                <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.failed_at')}:</span>{' '}
                {new Date(gen.failedAt).toLocaleString()}
              </div>
            )}
            {gen.errorCode && (
              <div className="col-span-2">
                <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.error_code')}:</span>{' '}
                {gen.errorCode}
              </div>
            )}
            {gen.errorMessage && (
              <div className="col-span-2">
                <span className="text-muted-foreground"> {ragAdminT('lifecycle.columns.error_message')}:</span>{' '}
                {gen.errorMessage}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
