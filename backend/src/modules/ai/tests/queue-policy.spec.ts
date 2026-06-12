// File: backend/src/modules/ai/tests/queue-policy.spec.ts
// Change Log:
// - 2026-06-11: สร้าง unit tests สำหรับทดสอบ Queue Policy & Selective Realtime Concurrency (US4)
// - 2026-06-11: แก้ไข relative import ของ Attachment ให้ถูกต้อง (3 ระดับ)
// - 2026-06-11: นำเข้า Job และ AiRealtimeJobData เพื่อแก้ไข compile/lint errors

import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Job } from 'bullmq';
import { QUEUE_AI_BATCH } from '../../common/constants/queue.constants';
import {
  AiRealtimeProcessor,
  AiRealtimeJobData,
} from '../processors/ai-realtime.processor';
import { OcrService } from '../services/ocr.service';
import { OllamaService } from '../services/ollama.service';
import { AiAuditLog } from '../entities/ai-audit-log.entity';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';

describe('Queue Policy (US4)', () => {
  let processor: AiRealtimeProcessor;
  const mockBatchQueue = {
    add: jest.fn().mockResolvedValue({ id: 'redirected-job-id' }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
  };
  const mockOcrService = {
    detectAndExtract: jest.fn(),
  };
  const mockOllamaService = {
    getMainModelName: jest.fn().mockReturnValue('np-dms-ai'),
    generate: jest.fn(),
  };
  const mockAiAuditLogRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockAttachmentRepo = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRealtimeProcessor,
        { provide: getQueueToken(QUEUE_AI_BATCH), useValue: mockBatchQueue },
        { provide: OcrService, useValue: mockOcrService },
        { provide: OllamaService, useValue: mockOllamaService },
        {
          provide: getRepositoryToken(AiAuditLog),
          useValue: mockAiAuditLogRepo,
        },
        {
          provide: getRepositoryToken(Attachment),
          useValue: mockAttachmentRepo,
        },
      ],
    }).compile();
    processor = module.get<AiRealtimeProcessor>(AiRealtimeProcessor);
  });

  it('ควรอนุญาตให้ lightweight jobs รันได้โดยไม่ redirect', async () => {
    const jobClassify = {
      id: '1',
      data: {
        jobType: 'intent-classify',
        projectPublicId: 'project-1',
        payload: { query: 'test' },
      },
    } as unknown as Job<AiRealtimeJobData>;
    const resultClassify = await processor.process(jobClassify);
    expect(resultClassify).toEqual({ success: true, intent: 'GET_RFA' });
    expect(mockBatchQueue.add).not.toHaveBeenCalled();
    const jobTool = {
      id: '2',
      data: {
        jobType: 'tool-suggest',
        projectPublicId: 'project-1',
        payload: { query: 'test' },
      },
    } as unknown as Job<AiRealtimeJobData>;
    const resultTool = await processor.process(jobTool);
    expect(resultTool).toEqual({ success: true, suggestions: [] });
    expect(mockBatchQueue.add).not.toHaveBeenCalled();
  });

  it('ควร redirect generation-heavy jobs ไปยัง ai-batch queue', async () => {
    const jobSuggest = {
      id: '3',
      data: {
        jobType: 'ai-suggest',
        projectPublicId: 'project-1',
        payload: { query: 'test' },
      },
    } as unknown as Job<AiRealtimeJobData>;
    await processor.process(jobSuggest);
    expect(mockBatchQueue.add).toHaveBeenCalledWith(
      'ai-suggest',
      jobSuggest.data,
      { jobId: '3' }
    );
    const jobRag = {
      id: '4',
      data: {
        jobType: 'rag-query',
        projectPublicId: 'project-1',
        payload: { query: 'test' },
      },
    } as unknown as Job<AiRealtimeJobData>;
    await processor.process(jobRag);
    expect(mockBatchQueue.add).toHaveBeenCalledWith('rag-query', jobRag.data, {
      jobId: '4',
    });
  });

  it('ควร resume ai-batch เมื่อ realtime jobs ทั้งหมดเสร็จแล้วเท่านั้น', async () => {
    const firstJob = {
      id: '10',
      data: { jobType: 'intent-classify' },
    } as Job<AiRealtimeJobData>;
    const secondJob = {
      id: '11',
      data: { jobType: 'tool-suggest' },
    } as Job<AiRealtimeJobData>;
    await processor.onActive(firstJob);
    await processor.onActive(secondJob);
    expect(mockBatchQueue.pause).toHaveBeenCalledTimes(1);
    await processor.onCompleted(firstJob);
    expect(mockBatchQueue.resume).not.toHaveBeenCalled();
    await processor.onCompleted(secondJob);
    expect(mockBatchQueue.resume).toHaveBeenCalledTimes(1);
  });

  it('ควรยัง pause ai-batch ต่อเมื่อมี realtime job อื่น active อยู่แม้มี job หนึ่ง fail', async () => {
    const firstJob = {
      id: '12',
      data: { jobType: 'intent-classify' },
    } as Job<AiRealtimeJobData>;
    const secondJob = {
      id: '13',
      data: { jobType: 'tool-suggest' },
    } as Job<AiRealtimeJobData>;
    await processor.onActive(firstJob);
    await processor.onActive(secondJob);
    expect(mockBatchQueue.pause).toHaveBeenCalledTimes(1);
    await processor.onFailed(firstJob);
    expect(mockBatchQueue.resume).not.toHaveBeenCalled();
    await processor.onCompleted(secondJob);
    expect(mockBatchQueue.resume).toHaveBeenCalledTimes(1);
  });
});
