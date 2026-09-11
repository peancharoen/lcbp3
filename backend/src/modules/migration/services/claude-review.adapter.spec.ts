// File: backend/src/modules/migration/services/claude-review.adapter.spec.ts
// Change Log:
// - 2026-09-11: Initial creation — unit test สำหรับ ClaudeReviewAdapter
//   (Phase D, FR-008, D2 — mock HTTP, ไม่เรียก API จริง)

import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ClaudeReviewAdapter } from './claude-review.adapter';
import type { AiReviewInput } from './ai-review-provider.factory';
import type { ExcelCorrespondenceRow } from '../types/excel-review.types';

const makeRow = (
  overrides: Partial<ExcelCorrespondenceRow> = {}
): ExcelCorrespondenceRow => ({
  rowIndex: 2,
  documentNumber: 'DOC-001',
  subject: 'Test subject',
  correspondenceTypeCode: 'LTR',
  disciplineCode: 'CIV',
  revisionNumber: '0',
  issuedDate: new Date('2026-01-01'),
  receivedDate: new Date('2026-01-02'),
  senderOrgRaw: 'Sender Co.',
  receiverOrgRaw: 'Receiver Co.',
  fileName: 'doc-001.pdf',
  remarks: '',
  findings: [],
  ...overrides,
});

const makeInput = (rows: ExcelCorrespondenceRow[]): AiReviewInput => ({
  rows,
  projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
  provider: 'CLAUDE',
  batchStrategy: 'FULL',
});

/** Mock AxiosInstance ที่ใช้ใน adapter */
const createMockHttpClient = () => ({
  post: jest.fn(),
});

describe('ClaudeReviewAdapter', () => {
  let adapter: ClaudeReviewAdapter;
  let mockHttpClient: ReturnType<typeof createMockHttpClient>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockHttpClient = createMockHttpClient();
    configService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    const module = await Test.createTestingModule({
      providers: [
        ClaudeReviewAdapter,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    adapter = module.get<ClaudeReviewAdapter>(ClaudeReviewAdapter);
    // แทนที่ httpClient ที่ adapter สร้างเองด้วย mock
    (adapter as unknown as { httpClient: typeof mockHttpClient }).httpClient =
      mockHttpClient;
  });

  describe('provider', () => {
    it('มี provider name เป็น CLAUDE', () => {
      expect(adapter.provider).toBe('CLAUDE');
    });
  });

  describe('isAvailable', () => {
    it('คืน true เมื่อ CLAUDE_API_KEY ถูกตั้งค่า', async () => {
      configService.get.mockReturnValue('fake-api-key');
      const module = await Test.createTestingModule({
        providers: [
          ClaudeReviewAdapter,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const freshAdapter = module.get<ClaudeReviewAdapter>(ClaudeReviewAdapter);

      const result = await freshAdapter.isAvailable();

      expect(result).toBe(true);
    });

    it('คืน false เมื่อ CLAUDE_API_KEY ไม่ได้ตั้งค่า (undefined)', async () => {
      configService.get.mockReturnValue(undefined);

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('review', () => {
    it('D.1.4: ส่ง review request → Claude API ตอบ 200 → คืน ReviewFinding[] ถูกต้อง', async () => {
      configService.get.mockReturnValue('fake-api-key');
      const module = await Test.createTestingModule({
        providers: [
          ClaudeReviewAdapter,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const freshAdapter = module.get<ClaudeReviewAdapter>(ClaudeReviewAdapter);
      (
        freshAdapter as unknown as { httpClient: typeof mockHttpClient }
      ).httpClient = mockHttpClient;

      mockHttpClient.post.mockResolvedValue({
        data: {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                suggestedSubject: 'แก้ไขเรื่องให้ชัดเจนขึ้น',
                suggestedType: 'RFA',
                suggestedDiscipline: 'MEC',
                confidence: 0.9,
                reason: 'subject สั้นเกินไปและ type ควรเป็น RFA',
              }),
            },
          ],
        },
      });

      const findings = await freshAdapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(1);
      expect(findings[0].level).toBe('AI_SUGGEST');
      expect(findings[0].row).toBe(2);
      expect(findings[0].column).toBe('AI Review');
      expect(findings[0].message).toContain('แนะนำเรื่อง');
      expect(findings[0].message).toContain('แนะนำประเภท');
      expect(findings[0].suggestedValue).toEqual({
        subject: 'แก้ไขเรื่องให้ชัดเจนขึ้น',
        type: 'RFA',
        discipline: 'MEC',
      });
      expect(findings[0].confidence).toBe(0.9);
    });

    it('D.1.5: Claude API ตอบ 429 (rate limit) → fail-open: คืน []', async () => {
      configService.get.mockReturnValue('fake-api-key');
      const module = await Test.createTestingModule({
        providers: [
          ClaudeReviewAdapter,
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      const freshAdapter = module.get<ClaudeReviewAdapter>(ClaudeReviewAdapter);
      (
        freshAdapter as unknown as { httpClient: typeof mockHttpClient }
      ).httpClient = mockHttpClient;

      mockHttpClient.post.mockRejectedValue(new Error('Rate limit exceeded'));

      const findings = await freshAdapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    it('D.1.6: ไม่มี API key → fail-open: คืน []', async () => {
      configService.get.mockReturnValue(undefined);

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });
  });
});
