// File: backend/src/modules/migration/workers/expire-pending-reviews.worker.spec.ts
// Change Log:
// - 2026-09-11: สร้าง Unit Test สำหรับ ExpirePendingReviewsWorker (Phase 2F.4 — coverage 24%→80%)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExpirePendingReviewsWorker } from './expire-pending-reviews.worker';
import {
  MigrationReviewQueue,
  MigrationReviewStatus,
} from '../entities/migration-review-queue.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationService } from '../../notification/notification.service';
import * as fs from 'fs-extra';

jest.mock('fs-extra');

interface MockQueryBuilder {
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getMany: jest.Mock;
}

describe('ExpirePendingReviewsWorker (Phase 2F.4)', () => {
  let worker: ExpirePendingReviewsWorker;

  const mockReviewQueueRepo = {
    find: jest.fn(),
    save: jest
      .fn()
      .mockImplementation((entity: Record<string, unknown>) =>
        Promise.resolve(entity)
      ),
  };

  const mockAttachmentRepo = {
    findOne: jest.fn(),
    remove: jest.fn().mockResolvedValue(undefined),
  };

  const mockQueryBuilder: MockQueryBuilder = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };

  const mockUserRepo = {
    createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
  };

  const mockNotificationService = {
    send: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.pathExists as jest.Mock).mockResolvedValue(false);
    (fs.remove as jest.Mock).mockResolvedValue(undefined);
    mockQueryBuilder.getMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpirePendingReviewsWorker,
        {
          provide: getRepositoryToken(MigrationReviewQueue),
          useValue: mockReviewQueueRepo,
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
      ],
    }).compile();

    worker = module.get<ExpirePendingReviewsWorker>(ExpirePendingReviewsWorker);
  });

  it('ควร log "No expired pending reviews found" เมื่อไม่มีรายการค้างเกิน 30 วัน', async () => {
    mockReviewQueueRepo.find.mockResolvedValue([]);

    await worker.handleExpiration();

    expect(mockReviewQueueRepo.find).toHaveBeenCalled();
    expect(mockReviewQueueRepo.save).not.toHaveBeenCalled();
    expect(mockNotificationService.send).not.toHaveBeenCalled();
  });

  it('ควร expire รายการ PENDING ที่เกิน 30 วัน → status=REJECTED, remarks=EXPIRED', async () => {
    const expiredRecord: Record<string, unknown> = {
      id: 1,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);

    await worker.handleExpiration();

    expect(mockReviewQueueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: MigrationReviewStatus.REJECTED,
        remarks: 'EXPIRED',
        reviewedBy: 'SYSTEM_AUTO_EXPIRATION',
      })
    );
  });

  it('ควรลบ temp attachment file และ record เมื่อ tempAttachmentId มีอยู่', async () => {
    const mockAttachment = { id: 99, filePath: '/tmp/test-file.pdf' };
    const expiredRecord: Record<string, unknown> = {
      id: 2,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: 99,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);
    mockAttachmentRepo.findOne.mockResolvedValue(mockAttachment);
    (fs.pathExists as jest.Mock).mockResolvedValue(true);

    await worker.handleExpiration();

    expect(fs.remove).toHaveBeenCalledWith('/tmp/test-file.pdf');
    expect(mockAttachmentRepo.remove).toHaveBeenCalledWith(mockAttachment);
    expect(mockReviewQueueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tempAttachmentId: undefined })
    );
  });

  it('ควรไม่ลบไฟล์ถ้า path ไม่มีจริง แต่ยึด remove record ทิ้ง', async () => {
    const mockAttachment = { id: 98, filePath: '/tmp/nonexistent.pdf' };
    const expiredRecord: Record<string, unknown> = {
      id: 3,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: 98,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);
    mockAttachmentRepo.findOne.mockResolvedValue(mockAttachment);
    (fs.pathExists as jest.Mock).mockResolvedValue(false);

    await worker.handleExpiration();

    expect(fs.remove).not.toHaveBeenCalled();
    expect(mockAttachmentRepo.remove).toHaveBeenCalledWith(mockAttachment);
  });

  it('ควรข้าม temp attachment เมื่อ findOne ไม่พบ record', async () => {
    const expiredRecord: Record<string, unknown> = {
      id: 4,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: 777,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);
    mockAttachmentRepo.findOne.mockResolvedValue(null);

    await worker.handleExpiration();

    expect(mockAttachmentRepo.remove).not.toHaveBeenCalled();
    expect(mockReviewQueueRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: MigrationReviewStatus.REJECTED })
    );
  });

  it('ควรแจ้งเตือน Admin ทุกคนเมื่อมี expiredCount > 0', async () => {
    const expiredRecord: Record<string, unknown> = {
      id: 5,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);
    mockQueryBuilder.getMany.mockResolvedValue([
      { user_id: 1, username: 'admin' },
      { user_id: 2, username: 'superadmin' },
    ]);

    await worker.handleExpiration();

    expect(mockNotificationService.send).toHaveBeenCalledTimes(2);
    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        type: 'SYSTEM',
      })
    );
    expect(mockNotificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 2,
      })
    );
  });

  it('ควร log error แต่ไม่ crash เมื่อ notification send ล้มเหลว', async () => {
    const expiredRecord: Record<string, unknown> = {
      id: 6,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    mockReviewQueueRepo.find.mockResolvedValue([expiredRecord]);
    mockQueryBuilder.getMany.mockResolvedValue([
      { user_id: 1, username: 'admin' },
    ]);
    mockNotificationService.send.mockRejectedValue(new Error('SMTP timeout'));

    // ไม่ควร throw
    await expect(worker.handleExpiration()).resolves.toBeUndefined();
  });

  it('ควร log error แต่ไม่ crash เมื่อ save record ล้มเหลว และทำต่อรายการถัดไป', async () => {
    const record1: Record<string, unknown> = {
      id: 7,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    const record2: Record<string, unknown> = {
      id: 8,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    mockReviewQueueRepo.find.mockResolvedValue([record1, record2]);
    mockReviewQueueRepo.save
      .mockRejectedValueOnce(new Error('DB constraint'))
      .mockResolvedValueOnce(record2);

    await worker.handleExpiration();

    // record1 fail → log error, record2 success → save called twice
    expect(mockReviewQueueRepo.save).toHaveBeenCalledTimes(2);
  });

  it('ควรไม่แจ้งเตือน Admin เมื่อ expiredCount = 0 (ทุกรายการ fail)', async () => {
    const record: Record<string, unknown> = {
      id: 9,
      status: MigrationReviewStatus.PENDING,
      tempAttachmentId: undefined,
    };
    mockReviewQueueRepo.find.mockResolvedValue([record]);
    mockReviewQueueRepo.save.mockRejectedValue(new Error('DB down'));

    await worker.handleExpiration();

    expect(mockNotificationService.send).not.toHaveBeenCalled();
  });

  it('ควร catch และ log error ระดับนอกสุดเมื่อ reviewQueueRepo.find throw', async () => {
    mockReviewQueueRepo.find.mockRejectedValue(new Error('Connection lost'));

    // ไม่ควร throw
    await expect(worker.handleExpiration()).resolves.toBeUndefined();
  });
});
