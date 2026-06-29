// File: src/modules/ai/workers/cleanup-temp-files.worker.spec.ts
// Change Log:
// - 2026-06-02: เพิ่ม regression test สำหรับ schema drift ของ temp_attachment_id

import { CleanupTempFilesWorker } from './cleanup-temp-files.worker';
import { MigrationReviewStatus } from '../../migration/entities/migration-review-queue.entity';

describe('CleanupTempFilesWorker', () => {
  const reviewQueueRepository = {
    find: jest.fn(),
  };
  const attachmentQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const attachmentRepository = {
    createQueryBuilder: jest.fn().mockReturnValue(attachmentQueryBuilder),
    remove: jest.fn(),
  };

  let worker: CleanupTempFilesWorker;

  beforeEach(() => {
    jest.clearAllMocks();
    attachmentQueryBuilder.where.mockReturnThis();
    attachmentQueryBuilder.andWhere.mockReturnThis();
    worker = new CleanupTempFilesWorker(
      attachmentRepository as never,
      reviewQueueRepository as never
    );
  });

  it('should skip cleanup safely when temp_attachment_id column is missing', async () => {
    reviewQueueRepository.find.mockRejectedValue(
      new Error(
        "Unknown column 'MigrationReviewQueue.temp_attachment_id' in 'SELECT'"
      )
    );
    const warnSpy = jest.spyOn(worker['logger'], 'warn');
    const errorSpy = jest.spyOn(worker['logger'], 'error');

    await worker.handleCleanup();

    expect(reviewQueueRepository.find).toHaveBeenCalledWith({
      select: ['tempAttachmentId'],
      where: { status: MigrationReviewStatus.PENDING },
    });
    expect(attachmentRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'migration_review_queue.temp_attachment_id is missing'
      )
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
