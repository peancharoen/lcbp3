// File: backend/src/modules/distribution/services/approval-listener.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ ApprovalListenerService (T055, FR-018)

/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalListenerService } from './approval-listener.service';
import { DistributionService } from '../distribution.service';
import { ConsensusDecision } from '../../common/enums/review.enums';
import { DistributionJobPayload } from '../distribution.service';

describe('ApprovalListenerService', () => {
  let service: ApprovalListenerService;
  const mockDistributionService = {
    queueDistribution: jest.fn().mockResolvedValue(undefined),
  };

  const baseEvent = {
    rfaPublicId: 'rfa-uuid-001',
    rfaRevisionPublicId: 'rev-uuid-001',
    projectId: 5,
    documentTypeId: 2,
    documentTypeCode: 'SHOP_DRAWING',
    responseCode: '1A',
    approvedAt: new Date('2026-06-06T00:00:00Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApprovalListenerService,
        {
          provide: DistributionService,
          useValue: mockDistributionService,
        },
      ],
    }).compile();
    service = module.get<ApprovalListenerService>(ApprovalListenerService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onConsensusReached — should distribute', () => {
    it('ควร queue distribution เมื่อ decision=APPROVED', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.APPROVED,
      });

      const expectedPayload: DistributionJobPayload = {
        rfaPublicId: baseEvent.rfaPublicId,
        rfaRevisionPublicId: baseEvent.rfaRevisionPublicId,
        projectId: baseEvent.projectId,
        documentTypeId: baseEvent.documentTypeId,
        documentTypeCode: baseEvent.documentTypeCode,
        responseCode: baseEvent.responseCode,
        approvedAt: baseEvent.approvedAt,
      };
      expect(mockDistributionService.queueDistribution).toHaveBeenCalledTimes(
        1
      );
      expect(mockDistributionService.queueDistribution).toHaveBeenCalledWith(
        expectedPayload
      );
    });

    it('ควร queue distribution เมื่อ decision=APPROVED_WITH_COMMENTS', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.APPROVED_WITH_COMMENTS,
      });

      expect(mockDistributionService.queueDistribution).toHaveBeenCalledTimes(
        1
      );
      expect(mockDistributionService.queueDistribution).toHaveBeenCalledWith(
        expect.objectContaining({
          responseCode: '1A',
          approvedAt: baseEvent.approvedAt,
        })
      );
    });

    it('ควร queue distribution เมื่อ decision=OVERRIDDEN', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.OVERRIDDEN,
      });

      expect(mockDistributionService.queueDistribution).toHaveBeenCalledTimes(
        1
      );
    });
  });

  describe('onConsensusReached — should NOT distribute', () => {
    it('ควรไม่ queue distribution เมื่อ decision=REJECTED', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.REJECTED,
      });

      expect(mockDistributionService.queueDistribution).not.toHaveBeenCalled();
    });

    it('ควรไม่ queue distribution เมื่อ decision=PENDING', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.PENDING,
      });

      expect(mockDistributionService.queueDistribution).not.toHaveBeenCalled();
    });
  });

  describe('onConsensusReached — payload propagation', () => {
    it('ควรส่ง payload ครบทุก field ไปยัง queueDistribution', async () => {
      await service.onConsensusReached({
        ...baseEvent,
        decision: ConsensusDecision.APPROVED,
      });

      const callArg = mockDistributionService.queueDistribution.mock
        .calls[0][0] as DistributionJobPayload;
      expect(callArg.rfaPublicId).toBe('rfa-uuid-001');
      expect(callArg.rfaRevisionPublicId).toBe('rev-uuid-001');
      expect(callArg.projectId).toBe(5);
      expect(callArg.documentTypeId).toBe(2);
      expect(callArg.documentTypeCode).toBe('SHOP_DRAWING');
      expect(callArg.responseCode).toBe('1A');
      expect(callArg.approvedAt).toBeInstanceOf(Date);
    });

    it('ควรรองรับ event ที่ไม่มี documentTypeId/documentTypeCode', async () => {
      await service.onConsensusReached({
        rfaPublicId: 'rfa-uuid-002',
        rfaRevisionPublicId: 'rev-uuid-002',
        projectId: 7,
        responseCode: '2',
        decision: ConsensusDecision.APPROVED,
        approvedAt: new Date(),
      });

      const callArg = mockDistributionService.queueDistribution.mock
        .calls[0][0] as DistributionJobPayload;
      expect(callArg.documentTypeId).toBeUndefined();
      expect(callArg.documentTypeCode).toBeUndefined();
    });
  });
});
