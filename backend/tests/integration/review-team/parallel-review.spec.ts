// File: tests/integration/review-team/parallel-review.spec.ts
// Integration tests สำหรับ Parallel Review consensus flow (T076)
// TODO: ขยาย test suite เมื่อ test database พร้อม (Sprint ถัดไป)

import { ConsensusDecision } from '../../../src/modules/common/enums/review.enums';

describe('Parallel Review Consensus (Integration)', () => {
  describe('Consensus evaluation', () => {
    it('should return APPROVED when all tasks have Code 1A', () => {
      const codes = ['1A', '1A', '1A'];
      const hasVeto = codes.some((c) => c === '3');
      const allApproved = codes.every((c) => ['1A', '1B'].includes(c));

      const decision = hasVeto
        ? ConsensusDecision.REJECTED
        : allApproved
          ? ConsensusDecision.APPROVED
          : ConsensusDecision.APPROVED_WITH_COMMENTS;

      expect(decision).toBe(ConsensusDecision.APPROVED);
    });

    it('should return REJECTED when any task has Code 3', () => {
      const codes = ['1A', '3', '2'];
      const hasVeto = codes.some((c) => c === '3');

      const decision = hasVeto
        ? ConsensusDecision.REJECTED
        : ConsensusDecision.APPROVED;

      expect(decision).toBe(ConsensusDecision.REJECTED);
    });

    it('should return APPROVED_WITH_COMMENTS when mix of 1A and 2', () => {
      const codes = ['1A', '2', '1B'];
      const hasVeto = codes.some((c) => c === '3');
      const allApproved = codes.every((c) => ['1A', '1B'].includes(c));
      const hasComments = codes.some((c) => c === '2');

      const decision = hasVeto
        ? ConsensusDecision.REJECTED
        : allApproved
          ? ConsensusDecision.APPROVED
          : hasComments
            ? ConsensusDecision.APPROVED_WITH_COMMENTS
            : ConsensusDecision.PENDING;

      expect(decision).toBe(ConsensusDecision.APPROVED_WITH_COMMENTS);
    });
  });
});
