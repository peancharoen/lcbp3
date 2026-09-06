// File: backend/src/modules/migration/services/ai-review-provider.factory.spec.ts
// Test for AiReviewProviderFactory (T012, FR-008, FR-009, D2)

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  AiReviewProviderFactory,
  AiReviewerAdapter,
  AiReviewInput,
  AI_REVIEWER_ADAPTERS,
} from './ai-review-provider.factory';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
} from '../types/excel-review.types';

describe('AiReviewProviderFactory', () => {
  let factory: AiReviewProviderFactory;
  let mockAdapters: jest.Mocked<AiReviewerAdapter>[];

  function makeRow(
    overrides: Partial<ExcelCorrespondenceRow> = {}
  ): ExcelCorrespondenceRow {
    return {
      rowIndex: 2,
      documentNumber: 'DOC-001',
      subject: 'Test',
      revisionNumber: '0',
      findings: [],
      ...overrides,
    };
  }

  function makeInput(overrides: Partial<AiReviewInput> = {}): AiReviewInput {
    return {
      rows: [makeRow()],
      projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      provider: 'LOCAL_OLLAMA',
      batchStrategy: 'FULL',
      ...overrides,
    };
  }

  async function setupFactory(
    allowExternal: boolean,
    adapters: AiReviewerAdapter[]
  ): Promise<AiReviewProviderFactory> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'ALLOW_EXTERNAL_AI_REVIEW'
                ? allowExternal
                  ? 'true'
                  : 'false'
                : undefined,
          },
        },
        {
          provide: AI_REVIEWER_ADAPTERS,
          useValue: adapters,
        },
        AiReviewProviderFactory,
      ],
    }).compile();
    return moduleRef.get(AiReviewProviderFactory);
  }

  beforeEach(() => {
    mockAdapters = [];
  });

  it('Fail-Open เมื่อ provider ไม่ใช่ LOCAL_OLLAMA และ ALLOW_EXTERNAL_AI_REVIEW != true', async () => {
    factory = await setupFactory(false, mockAdapters);
    const result = await factory.review(makeInput({ provider: 'GEMINI' }));
    expect(result.available).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.unavailableReason).toContain('ปิดใช้งาน');
  });

  it('Fail-Open เมื่อไม่พบ adapter สำหรับ provider ที่ระบุ', async () => {
    factory = await setupFactory(true, mockAdapters);
    const result = await factory.review(makeInput({ provider: 'CLAUDE' }));
    expect(result.available).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.unavailableReason).toContain('ไม่รองรับ');
  });

  it('Fail-Open เมื่อ adapter.isAvailable() คืน false', async () => {
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'LOCAL_OLLAMA',
      isAvailable: jest.fn().mockResolvedValue(false),
      review: jest.fn(),
    };
    mockAdapters.push(adapter);
    factory = await setupFactory(true, mockAdapters);

    const result = await factory.review(makeInput());
    expect(result.available).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.unavailableReason).toContain('ไม่พร้อม');
    expect(adapter.review).not.toHaveBeenCalled();
  });

  it('Fail-Open เมื่อ adapter.isAvailable() throw error', async () => {
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'LOCAL_OLLAMA',
      isAvailable: jest.fn().mockRejectedValue(new Error('connection refused')),
      review: jest.fn(),
    };
    mockAdapters.push(adapter);
    factory = await setupFactory(true, mockAdapters);

    const result = await factory.review(makeInput());
    expect(result.available).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.unavailableReason).toContain('connection refused');
  });

  it('Fail-Open เมื่อ adapter.review() throw error', async () => {
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'LOCAL_OLLAMA',
      isAvailable: jest.fn().mockResolvedValue(true),
      review: jest.fn().mockRejectedValue(new Error('AI timeout')),
    };
    mockAdapters.push(adapter);
    factory = await setupFactory(true, mockAdapters);

    const result = await factory.review(makeInput());
    expect(result.available).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.unavailableReason).toContain('AI timeout');
  });

  it('คืน findings เมื่อ adapter ทำงานสำเร็จ', async () => {
    const findings: ReviewFinding[] = [
      {
        row: 2,
        column: 'AI Review',
        level: 'AI_SUGGEST',
        message: 'Suggest type RFA',
        originalValue: undefined,
        suggestedValue: { type: 'RFA' },
        confidence: 0.9,
      },
    ];
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'LOCAL_OLLAMA',
      isAvailable: jest.fn().mockResolvedValue(true),
      review: jest.fn().mockResolvedValue(findings),
    };
    mockAdapters.push(adapter);
    factory = await setupFactory(true, mockAdapters);

    const result = await factory.review(makeInput());
    expect(result.available).toBe(true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].level).toBe('AI_SUGGEST');
    expect(adapter.review).toHaveBeenCalledWith(makeInput());
  });

  it('อนุญาต External AI เมื่อ ALLOW_EXTERNAL_AI_REVIEW=true', async () => {
    const findings: ReviewFinding[] = [
      {
        row: 2,
        column: 'AI Review',
        level: 'AI_SUGGEST',
        message: 'Suggest from Gemini',
        originalValue: undefined,
        confidence: 0.85,
      },
    ];
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'GEMINI',
      isAvailable: jest.fn().mockResolvedValue(true),
      review: jest.fn().mockResolvedValue(findings),
    };
    mockAdapters.push(adapter);
    factory = await setupFactory(true, mockAdapters);

    const result = await factory.review(makeInput({ provider: 'GEMINI' }));
    expect(result.available).toBe(true);
    expect(result.findings).toHaveLength(1);
  });

  it('LOCAL_OLLAMA ไม่ต้องตรวจ ALLOW_EXTERNAL_AI_REVIEW', async () => {
    const adapter: jest.Mocked<AiReviewerAdapter> = {
      provider: 'LOCAL_OLLAMA',
      isAvailable: jest.fn().mockResolvedValue(true),
      review: jest.fn().mockResolvedValue([]),
    };
    mockAdapters.push(adapter);
    // allowExternal = false แต่ LOCAL_OLLAMA ยังต้องผ่านได้
    factory = await setupFactory(false, mockAdapters);

    const result = await factory.review(
      makeInput({ provider: 'LOCAL_OLLAMA' })
    );
    expect(result.available).toBe(true);
    expect(adapter.review).toHaveBeenCalled();
  });
});
