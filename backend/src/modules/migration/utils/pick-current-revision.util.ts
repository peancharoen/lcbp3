// File: backend/src/modules/migration/utils/pick-current-revision.util.ts
// Change Log:
// - 2026-09-23: แยกออกจาก revision-label.util.ts (Single Export rule,
//   03-typescript.md) — เดิมไฟล์เดียว export 8 symbols

import { compareRevisionLabels } from './compare-revision-labels.util';
import { revisionLabelOf } from './revision-label-of.util';
import { RevisionLabelCarrier } from './revision-label-carrier.type';

/**
 * เลือก revision ลำดับสูงสุด (current) โดยเทียบ normalized label —
 * deterministic และ order-independent (import 'B' ก่อน 'A' ก็ได้ 'B' เป็น current)
 */
export function pickCurrentRevision<T extends RevisionLabelCarrier>(
  revisions: readonly T[]
): T {
  let best = revisions[0];
  for (const rev of revisions) {
    if (
      compareRevisionLabels(revisionLabelOf(rev), revisionLabelOf(best)) > 0
    ) {
      best = rev;
    }
  }
  return best;
}
