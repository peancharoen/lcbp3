// File: src/modules/distribution/distribution.service.spec.ts
// Change Log:
// - 2026-06-06: เพิ่ม unit tests สำหรับ DistributionService (T054)

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DistributionService } from './distribution.service';
import { DistributionJobPayload } from './distribution.service';
import { QUEUE_DISTRIBUTION } from '../common/constants/queue.constants';

describe('DistributionService', () => {
  let service: DistributionService;

  const mockQueue = {
    add: jest.fn(),
    getWaitingCount: jest.fn(),
    getActiveCount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributionService,
        {
          provide: getQueueToken(QUEUE_DISTRIBUTION),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<DistributionService>(DistributionService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('queueDistribution', () => {
    it('ควร add job ไปยัง distribution queue พร้อม options', async () => {
      const payload: DistributionJobPayload = {
        rfaPublicId: 'rfa-uuid-001',
        rfaRevisionPublicId: 'rev-uuid-001',
        projectId: 5,
        documentTypeId: 2,
        documentTypeCode: 'SHOP_DRAWING',
        responseCode: '1A',
        approvedAt: new Date('2026-01-01'),
      };
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      await service.queueDistribution(payload);

      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-distribution',
        payload,
        {
          removeOnComplete: true,
          removeOnFail: 100,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );
    });

    it('ควรทำงานได้แม้ไม่มี documentTypeId', async () => {
      const payload: DistributionJobPayload = {
        rfaPublicId: 'rfa-uuid-002',
        rfaRevisionPublicId: 'rev-uuid-002',
        projectId: 3,
        responseCode: '2',
        approvedAt: new Date('2026-02-01'),
      };
      mockQueue.add.mockResolvedValue({ id: 'job-2' });

      await service.queueDistribution(payload);

      expect(mockQueue.add).toHaveBeenCalled();
    });
  });

  describe('getJobStatus', () => {
    it('ควรคืน pending = waiting + active, completed = 0', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(3);
      mockQueue.getActiveCount.mockResolvedValue(2);

      const result = await service.getJobStatus('rfa-uuid-001');

      expect(result).toEqual({ pending: 5, completed: 0 });
      expect(mockQueue.getWaitingCount).toHaveBeenCalled();
      expect(mockQueue.getActiveCount).toHaveBeenCalled();
    });

    it('ควรคืน pending = 0 เมื่อ queue ว่าง', async () => {
      mockQueue.getWaitingCount.mockResolvedValue(0);
      mockQueue.getActiveCount.mockResolvedValue(0);

      const result = await service.getJobStatus('rfa-uuid-empty');

      expect(result).toEqual({ pending: 0, completed: 0 });
    });
  });
});
