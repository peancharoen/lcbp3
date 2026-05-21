// File: src/modules/review-team/services/consensus.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ ConsensusService (T068, FR-010)

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsensusService } from './consensus.service';
import { ReviewTask } from '../entities/review-task.entity';
import { AggregateStatusService } from './aggregate-status.service';
import { ApprovalListenerService } from '../../distribution/services/approval-listener.service';
import { ConsensusDecision } from '../../common/enums/review.enums';

// Context ใช้ซ้ำในหลาย tests
const baseContext = {
  rfaPublicId: 'rfa-uuid-001',
  rfaRevisionPublicId: 'rev-uuid-001',
  projectId: 5,
  documentTypeId: 2,
  documentTypeCode: 'SHOP_DRAWING',
};

describe('ConsensusService', () => {
  let service: ConsensusService;
  const mockTaskRepo = {}; // ConsensusService ไม่ใช้ repo โดยตรง
  const mockAggregateStatusService = {
    isReadyForConsensus: jest.fn(),
    getForRevision: jest.fn(),
    evaluateConsensus: jest.fn(),
    getMostRestrictiveResponseCode: jest.fn(),
  };
  const mockApprovalListenerService = {
    onConsensusReached: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsensusService,
        { provide: getRepositoryToken(ReviewTask), useValue: mockTaskRepo },
        {
          provide: AggregateStatusService,
          useValue: mockAggregateStatusService,
        },
        {
          provide: ApprovalListenerService,
          useValue: mockApprovalListenerService,
        },
      ],
    }).compile();
    service = module.get<ConsensusService>(ConsensusService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('evaluateAfterTaskComplete — NOT READY', () => {
    it('ควรคืน PENDING เมื่อยังไม่ครบทุก discipline', async () => {
      mockAggregateStatusService.isReadyForConsensus.mockResolvedValueOnce(
        false
      );
      mockAggregateStatusService.getForRevision.mockResolvedValueOnce({
        completed: 2,
        total: 4,
      });
      const result = await service.evaluateAfterTaskComplete(1, baseContext);
      expect(result.decision).toBe(ConsensusDecision.PENDING);
      expect(result.completedTasks).toBe(2);
      expect(result.totalTasks).toBe(4);
      expect(result.triggeredDistribution).toBe(false);
      expect(
        mockApprovalListenerService.onConsensusReached
      ).not.toHaveBeenCalled();
    });
  });

  describe('evaluateAfterTaskComplete — READY: APPROVED', () => {
    it('ควร trigger distribution เมื่อ decision=APPROVED', async () => {
      mockAggregateStatusService.isReadyForConsensus.mockResolvedValueOnce(
        true
      );
      mockAggregateStatusService.getForRevision.mockResolvedValueOnce({
        completed: 3,
        total: 3,
      });
      mockAggregateStatusService.evaluateConsensus.mockResolvedValueOnce(
        ConsensusDecision.APPROVED
      );
      mockAggregateStatusService.getMostRestrictiveResponseCode.mockResolvedValueOnce(
        '1A'
      );
      const result = await service.evaluateAfterTaskComplete(1, baseContext);
      expect(result.decision).toBe(ConsensusDecision.APPROVED);
      expect(result.triggeredDistribution).toBe(true);
      expect(
        mockApprovalListenerService.onConsensusReached
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          rfaPublicId: 'rfa-uuid-001',
          decision: ConsensusDecision.APPROVED,
          responseCode: '1A',
        })
      );
    });
  });

  describe('evaluateAfterTaskComplete — READY: APPROVED_WITH_COMMENTS', () => {
    it('ควร trigger distribution เมื่อ decision=APPROVED_WITH_COMMENTS', async () => {
      mockAggregateStatusService.isReadyForConsensus.mockResolvedValueOnce(
        true
      );
      mockAggregateStatusService.getForRevision.mockResolvedValueOnce({
        completed: 3,
        total: 3,
      });
      mockAggregateStatusService.evaluateConsensus.mockResolvedValueOnce(
        ConsensusDecision.APPROVED_WITH_COMMENTS
      );
      mockAggregateStatusService.getMostRestrictiveResponseCode.mockResolvedValueOnce(
        '2'
      );
      const result = await service.evaluateAfterTaskComplete(1, baseContext);
      expect(result.decision).toBe(ConsensusDecision.APPROVED_WITH_COMMENTS);
      expect(result.triggeredDistribution).toBe(true);
      expect(
        mockApprovalListenerService.onConsensusReached
      ).toHaveBeenCalledWith(expect.objectContaining({ responseCode: '2' }));
    });
  });

  describe('evaluateAfterTaskComplete — READY: REJECTED', () => {
    it('ควรไม่ trigger distribution เมื่อ decision=REJECTED', async () => {
      mockAggregateStatusService.isReadyForConsensus.mockResolvedValueOnce(
        true
      );
      mockAggregateStatusService.getForRevision.mockResolvedValueOnce({
        completed: 3,
        total: 3,
      });
      mockAggregateStatusService.evaluateConsensus.mockResolvedValueOnce(
        ConsensusDecision.REJECTED
      );
      const result = await service.evaluateAfterTaskComplete(1, baseContext);
      expect(result.decision).toBe(ConsensusDecision.REJECTED);
      expect(result.triggeredDistribution).toBe(false);
      expect(
        mockApprovalListenerService.onConsensusReached
      ).not.toHaveBeenCalled();
    });
  });

  describe('evaluateAfterTaskComplete — context propagation', () => {
    it('ควรส่ง context ทั้งหมดไปยัง onConsensusReached', async () => {
      mockAggregateStatusService.isReadyForConsensus.mockResolvedValueOnce(
        true
      );
      mockAggregateStatusService.getForRevision.mockResolvedValueOnce({
        completed: 2,
        total: 2,
      });
      mockAggregateStatusService.evaluateConsensus.mockResolvedValueOnce(
        ConsensusDecision.APPROVED
      );
      mockAggregateStatusService.getMostRestrictiveResponseCode.mockResolvedValueOnce(
        '1B'
      );
      await service.evaluateAfterTaskComplete(10, baseContext);
      const callArgs =
        mockApprovalListenerService.onConsensusReached.mock.calls[0][0];
      expect(callArgs.projectId).toBe(5);
      expect(callArgs.documentTypeCode).toBe('SHOP_DRAWING');
      expect(callArgs.rfaRevisionPublicId).toBe('rev-uuid-001');
      expect(callArgs.approvedAt).toBeInstanceOf(Date);
    });
  });
});
