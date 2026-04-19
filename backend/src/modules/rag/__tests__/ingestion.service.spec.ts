import { Test, TestingModule } from '@nestjs/testing';

import { IngestionService } from '../ingestion.service';

const QUEUE_TOKEN = 'BullQueue_rag:ocr';

const mockOcrQueue = {
  getJob: jest.fn(),
  add: jest.fn(),
};

const baseJobData = {
  attachmentPublicId: 'att-uuid-001',
  filePath: '/uploads/permanent/CORR/2026/04/file.pdf',
  docType: 'CORR',
  docNumber: 'REF-001',
  revision: null,
  projectCode: 'PRJ-001',
  projectPublicId: 'proj-uuid-001',
  classification: 'INTERNAL' as const,
};

describe('IngestionService', () => {
  let service: IngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        { provide: QUEUE_TOKEN, useValue: mockOcrQueue },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    jest.clearAllMocks();
  });

  it('should enqueue rag:ocr job with attachmentPublicId as jobId', async () => {
    mockOcrQueue.getJob.mockResolvedValue(null);
    mockOcrQueue.add.mockResolvedValue({ id: baseJobData.attachmentPublicId });

    await service.enqueue(baseJobData);

    expect(mockOcrQueue.add).toHaveBeenCalledWith('ocr', baseJobData, {
      jobId: baseJobData.attachmentPublicId,
    });
  });

  it('EC-RAG-001: duplicate enqueue when job is active → second call is no-op (log only)', async () => {
    const mockJob = { getState: jest.fn().mockResolvedValue('active') };
    mockOcrQueue.getJob.mockResolvedValue(mockJob);

    await service.enqueue(baseJobData);

    expect(mockOcrQueue.add).not.toHaveBeenCalled();
  });

  it('EC-RAG-001: duplicate enqueue when job is waiting → second call is no-op', async () => {
    const mockJob = { getState: jest.fn().mockResolvedValue('waiting') };
    mockOcrQueue.getJob.mockResolvedValue(mockJob);

    await service.enqueue(baseJobData);

    expect(mockOcrQueue.add).not.toHaveBeenCalled();
  });

  it('should re-enqueue if job exists but is completed (state=completed)', async () => {
    const mockJob = { getState: jest.fn().mockResolvedValue('completed') };
    mockOcrQueue.getJob.mockResolvedValue(mockJob);
    mockOcrQueue.add.mockResolvedValue({ id: baseJobData.attachmentPublicId });

    await service.enqueue(baseJobData);

    expect(mockOcrQueue.add).toHaveBeenCalledTimes(1);
  });

  it('should re-enqueue if job exists but is failed (state=failed)', async () => {
    const mockJob = { getState: jest.fn().mockResolvedValue('failed') };
    mockOcrQueue.getJob.mockResolvedValue(mockJob);
    mockOcrQueue.add.mockResolvedValue({ id: baseJobData.attachmentPublicId });

    await service.enqueue(baseJobData);

    expect(mockOcrQueue.add).toHaveBeenCalledTimes(1);
  });
});
