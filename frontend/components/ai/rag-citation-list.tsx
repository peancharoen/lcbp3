// File: frontend/components/ai/rag-citation-list.tsx
// Change Log:
// - 2026-09-12: สร้างคอมโพเนนต์แสดง citation จาก RAG retrieval ตาม contract
//   rag-retrieval.md (Feature 254, Phase 4 US2, T043) — แสดง attachmentPublicId,
//   segment info, snippet, score และ retrievalMode badge; ไม่แสดง generationUuid
//   ตาม ADR-019 (publicId เท่านั้น)
// - 2026-09-15: เพิ่ม segmentType badge (PAGE/SECTION/SHEET/WHOLE_DOCUMENT) และ
//   sourceLocator breadcrumb (Feature 254, Phase 6 US4, T062) — รองรับ non-page
//   source types และ ZIP inner-file sourceLocator ตาม contract rag-retrieval.md
// - 2026-09-16: T075 — แทนที่ hardcoded string ด้วย i18n keys จาก ai.json (rag namespace)

import { Badge } from '@/components/ui/badge';
import type { RagCitation, RagRetrievalMode, RagSegmentType } from '@/hooks/use-rag-query';
import aiMessages from '@/public/locales/th/ai.json';

/** T075: i18n helper สำหรับ rag namespace จาก ai.json (เดียวกับ review-queue-table.tsx) */
const ragT = (key: string): string => {
  const parts = key.split('.');
  let current: unknown = (aiMessages as Record<string, unknown>).rag;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
};

interface RagCitationListProps {
  /** รายการ citation ที่ได้จาก RAG query (ตาม contract `sources[]`) */
  sources: RagCitation[];
  /** โหมด retrieval ที่ใช้ค้นหา (VECTOR | FULL_TEXT | HYBRID) */
  retrievalMode: RagRetrievalMode;
}

/** แปลง retrievalMode เป็น badge variant สำหรับแสดงผล */
function retrievalModeVariant(
  mode: RagRetrievalMode
): 'default' | 'secondary' | 'outline' {
  switch (mode) {
    case 'VECTOR':
      return 'default';
    case 'FULL_TEXT':
      return 'secondary';
    case 'HYBRID':
      return 'outline';
    default:
      return 'outline';
  }
}

/** แปลง segmentType เป็น badge variant สำหรับแสดงผล */
function segmentTypeVariant(
  segmentType: RagSegmentType
): 'default' | 'secondary' | 'outline' | 'warning' {
  switch (segmentType) {
    case 'PAGE':
      return 'default';
    case 'SECTION':
      return 'secondary';
    case 'SHEET':
      return 'outline';
    case 'WHOLE_DOCUMENT':
      return 'warning';
    default:
      return 'outline';
  }
}

/** ฟอร์แมต score (0-1) เป็นเปอร์เซ็นต์ที่มนุษย์อ่านได้ */
function formatScore(score: number): string {
  return `${(score * 100).toFixed(1)}%`;
}

/**
 * สร้าง breadcrumb จาก sourceLocator และ segmentLabel
 *
 * - ถ้ามีทั้งสอง: "sourceLocator → segmentLabel"
 *   (เช่น "docs/spec.pdf → Page 3" หรือ "archive.zip → inner.pdf → Section 2")
 * - ถ้ามีเพียง sourceLocator: ส่งกลับ sourceLocator
 * - ถ้ามีเพียง segmentLabel: ส่งกลับ segmentLabel
 * - ถ้าไม่มีทั้งสอง: ส่งกลับ undefined (ไม่แสดง)
 */
function buildSourceBreadcrumb(
  sourceLocator: string | undefined,
  segmentLabel: string | undefined
): string | undefined {
  if (sourceLocator && segmentLabel) {
    return `${sourceLocator} → ${segmentLabel}`;
  }
  if (sourceLocator) {
    return sourceLocator;
  }
  if (segmentLabel) {
    return segmentLabel;
  }
  return undefined;
}

/**
 * คอมโพเนนต์สำหรับแสดงรายการ citation จากผลลัพธ์ RAG query
 *
 * - แสดง retrievalMode badge (VECTOR/FULL_TEXT/HYBRID) รวมถึง fallback mode
 * - แสดง segmentType badge (PAGE/SECTION/SHEET/WHOLE_DOCUMENT) ตาม segment type
 * - แสดง attachmentPublicId, sourceLocator breadcrumb, snippet, score
 * - ไม่แสดง generationUuid ตาม ADR-019 (contract ระบุว่าห้ามเปิดเผย)
 */
export function RagCitationList({
  sources,
  retrievalMode,
}: RagCitationListProps) {
  return (
    <div className="space-y-3" data-testid="rag-citation-list">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{ragT('citation_list.title')}</span>
        <Badge variant={retrievalModeVariant(retrievalMode)}>
          {retrievalMode}
        </Badge>
      </div>

      {sources.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {ragT('citation_list.empty')}
        </p>
      ) : (
        <ul className="space-y-2">
          {sources.map((citation, index) => {
            const breadcrumb = buildSourceBreadcrumb(
              citation.sourceLocator,
              citation.segmentLabel
            );
            return (
              <li
                key={`${citation.chunkPublicId}-${index}`}
                className="rounded border border-border bg-muted/40 p-3 text-sm space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-mono text-xs break-all"
                    data-testid={`citation-attachment-${index}`}
                  >
                    {citation.attachmentPublicId}
                  </span>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant={segmentTypeVariant(citation.segmentType)}
                      data-testid={`citation-segment-type-${index}`}
                    >
                      {citation.segmentType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatScore(citation.score)}
                    </span>
                  </div>
                </div>
                {breadcrumb && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid={`citation-locator-${index}`}
                  >
                    {breadcrumb}
                  </p>
                )}
                {citation.snippet && (
                  <p className="text-muted-foreground line-clamp-3">
                    {citation.snippet}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
