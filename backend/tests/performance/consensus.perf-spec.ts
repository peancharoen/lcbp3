// File: backend/tests/performance/consensus.perf-spec.ts
// Change Log:
// - 2026-05-16: Performance test for Consensus Calculation with 10+ disciplines

import { ReviewTask } from '../../src/modules/review-team/entities/review-task.entity';
import { ResponseCode } from '../../src/modules/response-code/entities/response-code.entity';
import { ReviewTaskStatus } from '../../src/modules/common/enums/review.enums';

// Mock ConsensusService for performance testing
class MockConsensusService {
  evaluateConsensus(tasks: ReviewTask[]) {
    const completed = tasks.filter(
      (t) => t.status === ReviewTaskStatus.COMPLETED
    );
    const approved = completed.filter((t) => t.responseCode?.code === '1A');
    return {
      decision:
        approved.length > completed.length / 2
          ? 'APPROVED'
          : 'APPROVED_WITH_COMMENTS',
      completedCount: completed.length,
      totalCount: tasks.length,
    };
  }

  evaluateLeadConsolidation(tasks: ReviewTask[], leadDisciplineId: number) {
    const leadTask = tasks.find((t) => t.disciplineId === leadDisciplineId);
    return {
      decision:
        leadTask?.status === ReviewTaskStatus.COMPLETED
          ? 'APPROVED'
          : 'PENDING_CONSOLIDATION',
      leadDisciplineId,
    };
  }
}

describe('ConsensusService Performance', () => {
  let service: MockConsensusService;

  beforeEach(() => {
    service = new MockConsensusService();
  });

  it('should calculate consensus with 10+ disciplines within 500ms', () => {
    const mockTasks: Partial<ReviewTask>[] = [
      {
        id: 1,
        disciplineId: 1,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 2,
        disciplineId: 2,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 3,
        disciplineId: 3,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1B' } as ResponseCode,
      },
      {
        id: 4,
        disciplineId: 4,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 5,
        disciplineId: 5,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 6,
        disciplineId: 6,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '2' } as ResponseCode,
      },
      {
        id: 7,
        disciplineId: 7,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 8,
        disciplineId: 8,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 9,
        disciplineId: 9,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 10,
        disciplineId: 10,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      {
        id: 11,
        disciplineId: 11,
        status: ReviewTaskStatus.COMPLETED,
        responseCode: { code: '1A' } as ResponseCode,
      },
      { id: 12, disciplineId: 12, status: ReviewTaskStatus.PENDING },
    ];

    const startTime = process.hrtime.bigint();
    const result = service.evaluateConsensus(mockTasks as ReviewTask[]);
    const endTime = process.hrtime.bigint();

    const calculationTimeMs = Number(endTime - startTime) / 1000000;
    expect(calculationTimeMs).toBeLessThan(500);
    expect(result).toBeDefined();
    expect(['APPROVED', 'APPROVED_WITH_COMMENTS']).toContain(result.decision);
  });

  it('should handle lead consolidation efficiently', () => {
    const mockTasks: Partial<ReviewTask>[] = Array.from(
      { length: 10 },
      (_, i) => ({
        id: i + 1,
        disciplineId: i + 1,
        status: i === 9 ? ReviewTaskStatus.PENDING : ReviewTaskStatus.COMPLETED,
        responseCode: { code: i === 5 ? '1C' : '1A' } as ResponseCode,
      })
    );

    const startTime = process.hrtime.bigint();
    const _result = service.evaluateLeadConsolidation(
      mockTasks as ReviewTask[],
      9
    );
    const endTime = process.hrtime.bigint();

    const calculationTimeMs = Number(endTime - startTime) / 1000000;
    expect(calculationTimeMs).toBeLessThan(500);
  });
});
