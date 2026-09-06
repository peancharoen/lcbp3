// File: backend/src/modules/migration/types/excel-review.types.spec.ts
// Change Log:
// - 2026-09-05: Initial creation — compile/shape smoke test สำหรับ data contracts
//   (Feature 252, T001/T002) — ไฟล์ type/DTO เป็น declaration ล้วนไม่มี
//   runtime behavior ให้ fail-first ตาม TDD จึงยึด compile-time correctness
//   เป็นการตรวจสอบหลัก (type-assertion compile check) บวก runtime shape
//   ของ constants และ class-validator decorators ที่ประกาศไว้
// - 2026-09-05: Fix Cycle 1 — เพิ่ม regression test ของ default `aiProvider`
//   ผ่าน path จริงของ global ValidationPipe (plainToInstance +
//   enableImplicitConversion ตาม backend/src/main.ts) หลัง review พบว่า
//   class field initializer ไม่ถูก apply ใน pipe path (FR-008, D2)

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  FindingLevel,
  ReviewTargetMode,
  AiReviewerProvider,
  ReviewSessionData,
  ReviewFinding,
  ExcelCorrespondenceRow,
  ReviewSummaryCounts,
  REVIEW_SESSION_TTL_SECONDS,
  REVIEW_SESSION_REDIS_PREFIX,
  ANNOTATED_AUDIT_COLUMN_PREFIX,
} from './excel-review.types';
import { CheckImportReviewDto } from '../dto/excel-import-review.dto';

/** Finding ตัวอย่างที่กรอกครบทุก field — compile fail ทันทีถ้า contract เปลี่ยน */
const sampleFinding: ReviewFinding = {
  row: 5,
  column: 'B',
  level: 'WARN',
  message: 'หน่วยงานผู้ส่งไม่ตรงกับ Master Data',
  originalValue: 'หจก. ตัวอย่าง ก่อสร้าง',
  suggestedValue: 'ORG-001',
  confidence: 0.87,
};

/** Session ตัวอย่างที่กรอกครบทุก field ตาม data-model.md §1 */
const sampleSession: ReviewSessionData = {
  reviewSessionPublicId: '019505a1-7c3e-7000-8000-abc123def456',
  projectPublicId: '019505a1-7c3e-7000-8000-def123abc456',
  targetMode: 'DIRECT_IMPORT',
  uploadedBy: '019505a1-7c3e-7000-8000-112233445566',
  totalRows: 20,
  passCount: 15,
  warnCount: 3,
  blockCount: 1,
  aiSuggestCount: 1,
  originalFileName: 'register.xlsx',
  originalFilePath:
    '/uploads/staging/import-review/019505a1-7c3e-7000-8000-abc123def456/register.xlsx',
  annotatedFilePath:
    '/uploads/staging/import-review/019505a1-7c3e-7000-8000-abc123def456/annotated.xlsx',
  selectedAiProvider: 'LOCAL_OLLAMA',
  status: 'READY',
  createdAt: '2026-09-05T10:00:00.000Z',
  expiresAt: '2026-09-06T10:00:00.000Z',
};

/** แถวข้อมูลตัวอย่างที่กรอกครบทุก field ตาม data-model.md §3 */
const sampleRow: ExcelCorrespondenceRow = {
  rowIndex: 2,
  documentNumber: 'CORR-LOT1-2026-0001',
  subject: 'ขออนุมัติวัสดุก่อสร้างเพิ่มเติม',
  correspondenceTypeCode: 'LTR',
  disciplineCode: 'CIV',
  revisionNumber: '0',
  issuedDate: new Date('2025-01-15T00:00:00.000Z'),
  receivedDate: new Date('2025-01-16T00:00:00.000Z'),
  senderOrgRaw: 'หจก. ตัวอย่าง ก่อสร้าง',
  senderOrgId: 12,
  receiverOrgRaw: 'บริษัท ตัวอย่าง จำกัด',
  receiverOrgId: 34,
  fileName: 'CORR-LOT1-2026-0001.pdf',
  resolvedPdfPath:
    '/uploads/staging/import-review/019505a1-7c3e-7000-8000-abc123def456/pdfs/CORR-LOT1-2026-0001.pdf',
  remarks: 'ตัวอย่างหมายเหตุ',
  findings: [sampleFinding],
};

describe('excel-review.types — data contracts (Feature 252, T002)', () => {
  it('FindingLevel มีสมาชิกครบตาม data-model.md §2 (compile check)', () => {
    const findingLevels: FindingLevel[] = ['BLOCK', 'WARN', 'AI_SUGGEST'];
    expect(findingLevels).toEqual(['BLOCK', 'WARN', 'AI_SUGGEST']);
  });

  it('ReviewTargetMode มีสมาชิกครบตาม FR-001 (compile check)', () => {
    const targetModes: ReviewTargetMode[] = [
      'MIGRATION_STAGING',
      'DIRECT_IMPORT',
    ];
    expect(targetModes).toHaveLength(2);
  });

  it('AiReviewerProvider มีสมาชิกครบตาม FR-008 (compile check)', () => {
    const providers: AiReviewerProvider[] = [
      'LOCAL_OLLAMA',
      'GEMINI',
      'CLAUDE',
    ];
    expect(providers).toHaveLength(3);
  });

  it('ReviewSessionData มี field ครบทุก field ตาม data-model.md §1', () => {
    const expectedKeys: (keyof ReviewSessionData)[] = [
      'reviewSessionPublicId',
      'projectPublicId',
      'targetMode',
      'uploadedBy',
      'totalRows',
      'passCount',
      'warnCount',
      'blockCount',
      'aiSuggestCount',
      'originalFileName',
      'originalFilePath',
      'annotatedFilePath',
      'selectedAiProvider',
      'status',
      'createdAt',
      'expiresAt',
    ];
    expect(Object.keys(sampleSession).sort()).toEqual([...expectedKeys].sort());
  });

  it('status ของ ReviewSessionData มี union ครบทั้ง 4 ค่า (compile check)', () => {
    const statuses: ReviewSessionData['status'][] = [
      'READY',
      'CONFIRMED',
      'CANCELLED',
      'EXPIRED',
    ];
    expect(statuses).toHaveLength(4);
    expect(sampleSession.status).toBe('READY');
  });

  it('ReviewFinding รองรับ optional fields และค่า unknown', () => {
    const minimalFinding: ReviewFinding = {
      row: 7,
      column: 'E',
      level: 'BLOCK',
      message: 'ลำดับวันที่ขัดแย้งเชิงตรรกะ (received < issued)',
      originalValue: null,
    };
    expect(minimalFinding.suggestedValue).toBeUndefined();
    expect(minimalFinding.confidence).toBeUndefined();
    expect(sampleFinding.confidence).toBe(0.87);
  });

  it('ExcelCorrespondenceRow รองรับแถวที่มีเฉพาะ required fields (Edge case 4)', () => {
    const minimalRow: ExcelCorrespondenceRow = {
      rowIndex: 3,
      documentNumber: 'CORR-LOT1-2026-0002',
      subject: 'ลงทะเบียนล่วงหน้าไม่มีไฟล์แนบ',
      revisionNumber: '0',
      findings: [],
    };
    expect(minimalRow.fileName).toBeUndefined();
    expect(sampleRow.findings).toHaveLength(1);
    expect(sampleRow.revisionNumber).toBe('0');
  });

  it('ReviewSummaryCounts มี canConfirm เป็น boolean gate ของการยืนยัน', () => {
    const summary: ReviewSummaryCounts = {
      totalRows: 20,
      passCount: 15,
      warnCount: 4,
      blockCount: 1,
      aiSuggestCount: 2,
      canConfirm: false,
    };
    expect(summary.canConfirm).toBe(false);
    expect(summary.totalRows).toBe(20);
  });

  it('Constants ตรงตาม data-model.md (TTL 24 ชม., Redis prefix, [AI] prefix)', () => {
    expect(REVIEW_SESSION_TTL_SECONDS).toBe(86400);
    expect(REVIEW_SESSION_TTL_SECONDS / 3600).toBe(24);
    expect(REVIEW_SESSION_REDIS_PREFIX).toBe('import_review:session:');
    expect(
      `${REVIEW_SESSION_REDIS_PREFIX}${sampleSession.reviewSessionPublicId}`
    ).toBe('import_review:session:019505a1-7c3e-7000-8000-abc123def456');
    expect(ANNOTATED_AUDIT_COLUMN_PREFIX).toBe('[AI]');
    expect(
      '[AI] Suggested Type'.startsWith(ANNOTATED_AUDIT_COLUMN_PREFIX)
    ).toBe(true);
    expect('Subject'.startsWith(ANNOTATED_AUDIT_COLUMN_PREFIX)).toBe(false);
  });
});

describe('excel-import-review.dto — DTO contracts (Feature 252, T001)', () => {
  /** UUID รูปแบบ v4 สำหรับทดสอบ validation เท่านั้น */
  const validProjectPublicId = '123e4567-e89b-42d3-a456-426614174000';
  /** UUIDv7-like string จำลอง payload จริงของ pipe-path test (ADR-019) */
  const v7LikeProjectPublicId = '019505a1-7c3e-7000-8000-def123abc456';

  it('CheckImportReviewDto ผ่าน validation เมื่อครบ field ที่ required', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'DIRECT_IMPORT';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('aiProvider มี default LOCAL_OLLAMA และผ่าน validation เมื่อไม่ส่งมา', async () => {
    const dto = new CheckImportReviewDto();
    expect(dto.aiProvider).toBe('LOCAL_OLLAMA');
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'MIGRATION_STAGING';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.aiProvider).toBe('LOCAL_OLLAMA');
  });

  it('aiProvider default LOCAL_OLLAMA ต้องถูก apply ผ่าน path จริงของ ValidationPipe (Fix Cycle 1)', async () => {
    // จำลอง global ValidationPipe ใน backend/src/main.ts จริง (transform: true +
    // enableImplicitConversion: true โดยไม่มี exposeDefaultValues) — default
    // `aiProvider` ต้องถูก apply ใน path นี้ทั้งเมื่อ key หายไปและเมื่อ client
    // ส่งค่า falsy ('' จากฟอร์ม multipart / null จาก JSON) โดยไม่พึ่ง class
    // field initializer เพียงอย่างเดียว — จึงต้องมี @Transform ใน DTO
    // บังคับค่า default (FR-008, D2)
    const transformed = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
      },
      { enableImplicitConversion: true }
    );
    expect(transformed.aiProvider).toBe('LOCAL_OLLAMA');
    // หลัง transform แล้วต้องผ่าน class-validator ได้เหมือน pipe path จริง
    expect(await validate(transformed)).toHaveLength(0);

    // ค่าที่ client ส่งมาเองต้องถูก preserve ไม่ถูกเขียนทับด้วย default
    const explicit = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        aiProvider: 'GEMINI',
      },
      { enableImplicitConversion: true }
    );
    expect(explicit.aiProvider).toBe('GEMINI');

    // ฟอร์ม multipart ที่ append field `aiProvider` มาเป็นค่าว่าง ('') หรือ
    // JSON ที่ส่ง null ต้องได้รับ default เช่นกัน — เป็นสถานการณ์ที่ class
    // field initializer ถูกเขียนทับจริง (key มีอยู่ใน payload) และ @IsIn
    // จะ reject '' ทันทีถ้าไม่มี @Transform ปรับค่าให้ (FR-008, D2)
    const emptyField = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        aiProvider: '',
      },
      { enableImplicitConversion: true }
    );
    expect(emptyField.aiProvider).toBe('LOCAL_OLLAMA');

    const nullField = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        aiProvider: null,
      },
      { enableImplicitConversion: true }
    );
    expect(nullField.aiProvider).toBe('LOCAL_OLLAMA');
  });

  it('aiProvider ที่ส่งมาต้องอยู่ใน enum (GEMINI ผ่าน, ค่าอื่นไม่ผ่าน)', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'DIRECT_IMPORT';
    dto.aiProvider = 'GEMINI';
    expect(await validate(dto)).toHaveLength(0);

    (dto as { aiProvider: string }).aiProvider = 'OPENAI';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'aiProvider')).toBe(true);
  });

  it('targetMode ที่อยู่นอก enum ต้องไม่ผ่าน validation', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = validProjectPublicId;
    (dto as { targetMode: string }).targetMode = 'INVALID_MODE';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'targetMode')).toBe(true);
  });

  it('projectPublicId ที่ไม่ใช่ UUID ต้องไม่ผ่าน validation (ADR-019)', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = 'not-a-uuid';
    dto.targetMode = 'DIRECT_IMPORT';
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'projectPublicId')).toBe(true);
  });

  it('batchStrategy มี default FULL และผ่าน validation เมื่อไม่ส่งมา (Q3)', async () => {
    const dto = new CheckImportReviewDto();
    expect(dto.batchStrategy).toBe('FULL');
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'DIRECT_IMPORT';
    const errs = await validate(dto);
    expect(errs).toHaveLength(0);
    expect(dto.batchStrategy).toBe('FULL');
  });

  it('batchStrategy FULL และ FAST_SELECTIVE ผ่าน validation (Q3)', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'DIRECT_IMPORT';
    dto.batchStrategy = 'FAST_SELECTIVE';
    expect(await validate(dto)).toHaveLength(0);

    dto.batchStrategy = 'FULL';
    expect(await validate(dto)).toHaveLength(0);
  });

  it('batchStrategy ที่อยู่นอก enum ต้องไม่ผ่าน validation (Q3)', async () => {
    const dto = new CheckImportReviewDto();
    dto.projectPublicId = validProjectPublicId;
    dto.targetMode = 'DIRECT_IMPORT';
    (dto as { batchStrategy: string }).batchStrategy = 'BATCH';
    const errs = await validate(dto);
    expect(errs.some((e) => e.property === 'batchStrategy')).toBe(true);
  });

  it('batchStrategy default FULL ต้องถูก apply ผ่าน ValidationPipe path (Q3)', async () => {
    const transformed = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
      },
      { enableImplicitConversion: true }
    );
    expect(transformed.batchStrategy).toBe('FULL');
    expect(await validate(transformed)).toHaveLength(0);

    // ค่าว่าง/ null ต้องได้ default
    const emptyField = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        batchStrategy: '',
      },
      { enableImplicitConversion: true }
    );
    expect(emptyField.batchStrategy).toBe('FULL');

    const nullField = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        batchStrategy: null,
      },
      { enableImplicitConversion: true }
    );
    expect(nullField.batchStrategy).toBe('FULL');

    // ค่าที่ส่งมาเองต้อง preserve
    const explicit = plainToInstance(
      CheckImportReviewDto,
      {
        projectPublicId: v7LikeProjectPublicId,
        targetMode: 'DIRECT_IMPORT',
        batchStrategy: 'FAST_SELECTIVE',
      },
      { enableImplicitConversion: true }
    );
    expect(explicit.batchStrategy).toBe('FAST_SELECTIVE');
  });
});
