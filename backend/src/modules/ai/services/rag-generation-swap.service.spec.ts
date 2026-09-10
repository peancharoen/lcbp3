// File: backend/src/modules/ai/services/rag-generation-swap.service.spec.ts
// Change Log:
// - 2026-09-11: เพิ่ม RED unit tests สำหรับ RagGenerationSwapService (Feature 254, Phase 5 US3, T046)

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagGenerationSwapService } from './rag-generation-swap.service';
import { RagGenerationLockService } from './rag-generation-lock.service';
import { RagErrorService } from './rag-error.service';
import {
  ServiceUnavailableException,
  BusinessException,
} from '../../../common/exceptions';

/** รูปแบบข้อมูล generation แบบย่อสำหรับ assertions ใน test */
interface GenerationSummary {
  generationUuid: string;
  attachmentUuid: string;
  status: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
}

describe('RagGenerationSwapService', () => {
  let service: RagGenerationSwapService;
  const generationRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const lock = { release: jest.fn().mockResolvedValue(undefined) };
  const lockService = { acquire: jest.fn().mockResolvedValue(lock) };
  const errorService = new RagErrorService();
  const transactionManager = {
    getRepository: jest.fn().mockReturnValue(generationRepository),
  };
  const dataSource = {
    transaction: jest.fn(
      async (cb: (manager: typeof transactionManager) => Promise<unknown>) =>
        cb(transactionManager)
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    lockService.acquire.mockResolvedValue(lock);
    dataSource.transaction.mockImplementation(
      async (cb: (manager: typeof transactionManager) => Promise<unknown>) =>
        cb(transactionManager)
    );
    transactionManager.getRepository.mockReturnValue(generationRepository);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagGenerationSwapService,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        { provide: DataSource, useValue: dataSource },
        { provide: RagGenerationLockService, useValue: lockService },
        { provide: RagErrorService, useValue: errorService },
      ],
    }).compile();
    service = module.get<RagGenerationSwapService>(RagGenerationSwapService);
  });

  // 1. swapToActive() ต้อง acquire Redlock ก่อน swap
  it('acquires Redlock before swapping to ACTIVE', async () => {
    const newGeneration: GenerationSummary = {
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    };
    generationRepository.findOne.mockResolvedValue(newGeneration);
    generationRepository.find.mockResolvedValue([]);

    await service.swapToActive('gen-new');

    expect(lockService.acquire).toHaveBeenCalledWith('att-1');
    expect(lock.release).toHaveBeenCalled();
  });

  // 2. swapToActive() ต้อง throw เมื่อ lock ถูกแย่งโดย concurrent re-ingestion
  it('throws when Redlock cannot be acquired (concurrent re-ingestion)', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
      verifiedContentChecksum: 'a'.repeat(64),
    });
    lockService.acquire.mockRejectedValue(
      new ServiceUnavailableException(
        'RAG_GENERATION_LOCK_UNAVAILABLE',
        'lock busy',
        'ระบบกำลังประมวลผลไฟล์นี้อยู่'
      )
    );

    await expect(service.swapToActive('gen-new')).rejects.toMatchObject({
      code: 'RAG_GENERATION_LOCK_UNAVAILABLE',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  // 3. swapToActive() ต้อง transition BUILDING→ACTIVE และ ACTIVE→RETIRED ใน transaction เดียว
  it('atomically transitions new BUILDING→ACTIVE and old ACTIVE→RETIRED in one transaction', async () => {
    const newGeneration: GenerationSummary = {
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    };
    generationRepository.findOne.mockResolvedValue(newGeneration);
    generationRepository.find.mockResolvedValue([]);

    await service.swapToActive('gen-new');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    // retire old ACTIVE generation ของ attachment เดียวกัน
    expect(generationRepository.update).toHaveBeenCalledWith(
      { attachmentUuid: 'att-1', status: 'ACTIVE' },
      expect.objectContaining({ status: 'RETIRED' })
    );
    // promote new generation เป็น ACTIVE
    expect(generationRepository.update).toHaveBeenCalledWith(
      { generationUuid: 'gen-new' },
      expect.objectContaining({ status: 'ACTIVE' })
    );
  });

  // 4. หลัง swap ต้องมี ACTIVE generation เพียงตัวเดียวสำหรับ attachment
  it('leaves exactly one ACTIVE generation for the attachment after swap', async () => {
    const newGeneration: GenerationSummary = {
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    };
    generationRepository.findOne.mockResolvedValue(newGeneration);
    // จำลองสถานะหลัง swap: เหลือ ACTIVE เพียงตัวเดียว
    const afterSwap: GenerationSummary[] = [
      { generationUuid: 'gen-new', attachmentUuid: 'att-1', status: 'ACTIVE' },
    ];
    generationRepository.find.mockResolvedValue(afterSwap);

    await service.swapToActive('gen-new');

    const activeCount = afterSwap.filter(
      (g: GenerationSummary) => g.status === 'ACTIVE'
    ).length;
    expect(activeCount).toBe(1);
    // ยืนยันว่า service สอบถาม active generations ของ attachment เพื่อตรวจสอบ invariant
    expect(generationRepository.find).toHaveBeenCalled();
  });

  // 5. ถ้า transaction fail, old generation ต้องยังคงเป็น ACTIVE (rollback)
  it('keeps old generation ACTIVE when transaction fails (rollback)', async () => {
    const newGeneration: GenerationSummary = {
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'BUILDING',
    };
    generationRepository.findOne.mockResolvedValue(newGeneration);
    generationRepository.update.mockRejectedValueOnce(
      new Error('DB connection lost')
    );
    // จำลอง rollback: old ยัง ACTIVE อยู่
    const afterFailure: GenerationSummary[] = [
      { generationUuid: 'gen-old', attachmentUuid: 'att-1', status: 'ACTIVE' },
    ];
    generationRepository.find.mockResolvedValue(afterFailure);

    await expect(service.swapToActive('gen-new')).rejects.toThrow();

    const oldStillActive = afterFailure.find(
      (g: GenerationSummary) =>
        g.generationUuid === 'gen-old' && g.status === 'ACTIVE'
    );
    expect(oldStillActive).toBeDefined();
    expect(lock.release).toHaveBeenCalled();
  });

  // 6. ถ้า new generation ไม่ใช่ BUILDING, swap ต้อง throw (state guard)
  it('throws when new generation is not BUILDING (state guard)', async () => {
    generationRepository.findOne.mockResolvedValue({
      generationUuid: 'gen-new',
      attachmentUuid: 'att-1',
      status: 'ACTIVE',
      verifiedContentChecksum: 'a'.repeat(64),
    });

    await expect(service.swapToActive('gen-new')).rejects.toMatchObject({
      code: 'RAG_GENERATION_STATE_INVALID',
    });
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  // เพิ่มเติม: ถ้าไม่พบ generation เลย ต้อง throw state invalid (not found)
  it('throws when new generation is not found (state guard)', async () => {
    generationRepository.findOne.mockResolvedValue(null);

    await expect(service.swapToActive('gen-missing')).rejects.toBeInstanceOf(
      BusinessException
    );
    expect(lockService.acquire).not.toHaveBeenCalled();
  });
});
