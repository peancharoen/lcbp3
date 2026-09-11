// File: backend/src/modules/migration/services/local-ollama-review.adapter.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ LocalOllamaReviewAdapter
//   (T012, FR-008, D2 — coverage target ≥70%)

import { Test } from '@nestjs/testing';
import { OllamaService } from '../../ai/services/ollama.service';
import { LocalOllamaReviewAdapter } from './local-ollama-review.adapter';
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
  senderOrgId: 1,
  receiverOrgId: 2,
  fileName: 'doc-001.pdf',
  resolvedPdfPath: '',
  remarks: '',
  findings: [],
  ...overrides,
});

describe('LocalOllamaReviewAdapter', () => {
  let adapter: LocalOllamaReviewAdapter;
  let ollamaService: jest.Mocked<OllamaService>;

  beforeEach(async () => {
    ollamaService = {
      generate: jest.fn(),
    } as unknown as jest.Mocked<OllamaService>;

    const module = await Test.createTestingModule({
      providers: [
        LocalOllamaReviewAdapter,
        { provide: OllamaService, useValue: ollamaService },
      ],
    }).compile();

    adapter = module.get<LocalOllamaReviewAdapter>(LocalOllamaReviewAdapter);
  });

  describe('provider', () => {
    it('มี provider name เป็น LOCAL_OLLAMA', () => {
      expect(adapter.provider).toBe('LOCAL_OLLAMA');
    });
  });

  describe('isAvailable', () => {
    it('คืน true เมื่อ Ollama generate สำเร็จ', async () => {
      ollamaService.generate.mockResolvedValue('pong response');

      const result = await adapter.isAvailable();

      expect(result).toBe(true);
      expect(ollamaService.generate).toHaveBeenCalledWith('ping', {
        timeoutMs: 5000,
      });
    });

    it('คืน false เมื่อ Ollama generate throw (ไม่ start)', async () => {
      ollamaService.generate.mockRejectedValue(new Error('Connection refused'));

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });

    it('คืน false เมื่อ Ollama generate คืนค่าที่ไม่ใช่ string', async () => {
      ollamaService.generate.mockResolvedValue(null as unknown as string);

      const result = await adapter.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('review', () => {
    const makeInput = (rows: ExcelCorrespondenceRow[]): AiReviewInput => ({
      rows,
      projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
      provider: 'LOCAL_OLLAMA',
      batchStrategy: 'FULL',
    });

    it('คืน AI_SUGGEST finding เมื่อ Ollama คืน JSON ที่มี suggestion', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({
          suggestedSubject: 'แก้ไขเรื่องให้ชัดเจนขึ้น',
          suggestedType: 'RFA',
          suggestedDiscipline: 'MEC',
          confidence: 0.85,
          reason: 'subject สั้นเกินไปและ type ควรเป็น RFA',
        })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(1);
      expect(findings[0].level).toBe('AI_SUGGEST');
      expect(findings[0].row).toBe(2);
      expect(findings[0].column).toBe('AI Review');
      expect(findings[0].message).toContain('แนะนำเรื่อง');
      expect(findings[0].message).toContain('แนะนำประเภท');
      expect(findings[0].message).toContain('แนะนำสาขา');
      expect(findings[0].message).toContain('เหตุผล');
      expect(findings[0].suggestedValue).toEqual({
        subject: 'แก้ไขเรื่องให้ชัดเจนขึ้น',
        type: 'RFA',
        discipline: 'MEC',
      });
      expect(findings[0].confidence).toBe(0.85);
    });

    it('ข้ามแถวที่มี BLOCK finding อยู่แล้ว', async () => {
      const blockRow = makeRow({
        findings: [
          {
            row: 2,
            column: 'A',
            level: 'BLOCK',
            message: 'Invalid',
            originalValue: 'bad',
          },
        ],
      });
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ suggestedSubject: 'new subject' })
      );

      const findings = await adapter.review(makeInput([blockRow]));

      expect(findings).toHaveLength(0);
      expect(ollamaService.generate).not.toHaveBeenCalled();
    });

    it('คืน [] เมื่อ Ollama คืน JSON ที่ไม่มี suggestion ใดเลย', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ confidence: 0.5 })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    it('คืน [] เมื่อ Ollama คืน response ที่ไม่ใช่ JSON', async () => {
      ollamaService.generate.mockResolvedValue('not a json string');

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    it('Fail-Open: ข้ามแถวที่ Ollama generate throw ไม่ throw ออกมา', async () => {
      ollamaService.generate.mockRejectedValue(new Error('Ollama timeout'));

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    it('ประมวลผลหลายแถว — ข้าม BLOCK และ review แถวปกติ', async () => {
      const rows = [
        makeRow({
          rowIndex: 2,
          findings: [
            {
              row: 2,
              column: 'A',
              level: 'BLOCK',
              message: 'Bad',
              originalValue: 'x',
            },
          ],
        }),
        makeRow({ rowIndex: 3 }),
        makeRow({ rowIndex: 4 }),
      ];

      ollamaService.generate
        .mockResolvedValueOnce(
          JSON.stringify({ suggestedSubject: 'fix row 3' })
        )
        .mockResolvedValueOnce(
          JSON.stringify({ reason: 'row 4 looks fine but could improve' })
        );

      const findings = await adapter.review(makeInput(rows));

      expect(findings).toHaveLength(2);
      expect(findings[0].row).toBe(3);
      expect(findings[1].row).toBe(4);
      expect(ollamaService.generate).toHaveBeenCalledTimes(2);
    });

    it('clamp confidence ให้อยู่ในช่วง 0-1', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({
          suggestedSubject: 'test',
          confidence: 1.5,
        })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(1);
    });

    it('clamp confidence ติดลบให้เป็น 0', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({
          suggestedSubject: 'test',
          confidence: -0.3,
        })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBe(0);
    });

    it('confidence เป็น undefined เมื่อ AI ไม่ส่งมา', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ suggestedSubject: 'test' })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(1);
      expect(findings[0].confidence).toBeUndefined();
    });

    it('ส่ง prompt ที่มี documentNumber, subject, typeCode, disciplineCode', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ suggestedSubject: 'test' })
      );

      await adapter.review(
        makeInput([
          makeRow({
            documentNumber: 'COR-001',
            subject: 'เรื่องเร่งรัด',
            correspondenceTypeCode: 'LTR',
            disciplineCode: 'CIV',
          }),
        ])
      );

      const promptArg = ollamaService.generate.mock.calls[0][0];
      expect(promptArg).toContain('COR-001');
      expect(promptArg).toContain('เรื่องเร่งรัด');
      expect(promptArg).toContain('LTR');
      expect(promptArg).toContain('CIV');
    });

    it('ส่ง typeCode/disciplineCode เป็น empty string เมื่อไม่มีค่า', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ suggestedSubject: 'test' })
      );

      await adapter.review(
        makeInput([
          makeRow({
            correspondenceTypeCode: undefined as unknown as string,
            disciplineCode: undefined as unknown as string,
          }),
        ])
      );

      const promptArg = ollamaService.generate.mock.calls[0][0];
      const parsed = JSON.parse(promptArg) as {
        typeCode: string;
        disciplineCode: string;
      };
      expect(parsed.typeCode).toBe('');
      expect(parsed.disciplineCode).toBe('');
    });

    it('คืน [] เมื่อไม่มีแถวส่งมา', async () => {
      const findings = await adapter.review(makeInput([]));

      expect(findings).toHaveLength(0);
      expect(ollamaService.generate).not.toHaveBeenCalled();
    });

    // E.2.1: Ollama ตอบ JSON ที่ไม่ใช่ format ที่คาดหวาน → คืน [] (ไม่มี suggestion)
    it('E.2.1: คืน [] เมื่อ Ollama ตอบ JSON ที่ไม่ใช่ format ที่คาดหวาน', async () => {
      ollamaService.generate.mockResolvedValue(
        JSON.stringify({ foo: 'bar', baz: 42, unrelated: true })
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    // E.2.2: Ollama ตอบ empty response → fail-open
    it('E.2.2: คืน [] เมื่อ Ollama ตอบ empty string', async () => {
      ollamaService.generate.mockResolvedValue('');

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });

    // E.2.3: Ollama timeout → fail-open + ไม่ throw
    it('E.2.3: คืน [] เมื่อ Ollama timeout (error มีคำว่า timeout)', async () => {
      ollamaService.generate.mockRejectedValue(
        new Error('Request timed out after 30000ms')
      );

      const findings = await adapter.review(makeInput([makeRow()]));

      expect(findings).toHaveLength(0);
    });
  });
});
