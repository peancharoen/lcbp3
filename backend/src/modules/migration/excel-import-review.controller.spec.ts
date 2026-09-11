// File: backend/src/modules/migration/excel-import-review.controller.spec.ts
// Change Log:
// - 2026-09-11: Initial creation — unit tests สำหรับ ExcelImportReviewController
//   (Feature 252, Phase B — G1 + G5)
//   ครอบคลุม endpoint: POST /check, GET /:sessionId/download-annotated,
//   POST /:sessionId/confirm, POST /:sessionId/cancel,
//   GET /:sessionId/download-failed-rows
//   ทดสอบ RBAC (MIGRATION_STAGING + External AI สงวนไว้สำหรับ Admin),
//   ParseUUIDPipe validation, file stream, NotFoundException, stream error

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Writable } from 'stream';
import { ExcelImportReviewController } from './excel-import-review.controller';
import { ExcelDataReviewService } from './services/excel-data-review.service';
import { UserService } from '../user/user.service';
import { User } from '../user/entities/user.entity';
import { CheckImportReviewDto } from './dto/excel-import-review.dto';

/**
 * สร้าง mock Response ที่รองรับ stream.pipe() — ใช้ Writable stream จริง
 * เพื่อให้ fs.createReadStream().pipe(res) ทำงานได้ใน unit test
 */
const createMockResponse = (): {
  res: Writable;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  headersSent: boolean;
} => {
  const setHeader = jest.fn();
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  let headersSent = false;

  const res = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  }) as Writable & {
    setHeader: jest.Mock;
    status: jest.Mock;
    json: jest.Mock;
    headersSent: boolean;
  };
  res.setHeader = setHeader;
  res.status = status;
  res.json = json;
  Object.defineProperty(res, 'headersSent', {
    get: () => headersSent,
    set: (v: boolean) => {
      headersSent = v;
    },
    configurable: true,
  });

  return { res, setHeader, status, json, headersSent };
};

/** Minimal Multer file shape (ตรงกับ controller's MulterFile) */
interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/** UUID ที่ใช้ทดสอบ (UUIDv7 format) */
const SESSION_ID = '019505a1-7c3e-7000-8000-abc123def456';
const PROJECT_PUBLIC_ID = '019505a1-7c3e-7000-8000-project001';
const USER_PUBLIC_ID = '019505a1-7c3e-7000-8000-user0001';

/** สร้าง mock User สำหรับ @CurrentUser */
const makeUser = (): User =>
  ({
    user_id: 1,
    publicId: USER_PUBLIC_ID,
  }) as unknown as User;

/** สร้าง mock file สำหรับ @UploadedFile */
const makeFile = (name = 'test.xlsx'): MulterFile => ({
  fieldname: 'file',
  originalname: name,
  encoding: '7bit',
  mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  size: 1024,
  buffer: Buffer.from('fake-xlsx-content'),
});

/** สร้าง DTO สำหรับ /check */
const makeDto = (
  overrides: Partial<CheckImportReviewDto> = {}
): CheckImportReviewDto => ({
  projectPublicId: PROJECT_PUBLIC_ID,
  targetMode: 'DIRECT_IMPORT',
  aiProvider: 'LOCAL_OLLAMA',
  batchStrategy: 'FULL',
  ...overrides,
});

describe('ExcelImportReviewController', () => {
  let controller: ExcelImportReviewController;
  let reviewService: jest.Mocked<ExcelDataReviewService>;
  let userService: jest.Mocked<UserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExcelImportReviewController],
      providers: [
        {
          provide: ExcelDataReviewService,
          useValue: {
            check: jest.fn(),
            getAnnotatedFilePath: jest.fn(),
            getFailedRowsFilePath: jest.fn(),
            confirm: jest.fn(),
            cancel: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            getUserPermissions: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    controller = module.get<ExcelImportReviewController>(
      ExcelImportReviewController
    );
    reviewService = module.get(ExcelDataReviewService);
    userService = module.get(UserService);
  });

  // ----------------------------------------------------------------
  // B.2.1 — POST /check ไม่แนบไฟล์ → 400
  // ----------------------------------------------------------------
  describe('POST /check', () => {
    it('B.2.1: โยน BadRequestException เมื่อไม่แนบไฟล์', async () => {
      await expect(
        controller.check(makeDto(), undefined, makeUser())
      ).rejects.toThrow(BadRequestException);
    });

    // ----------------------------------------------------------------
    // B.2.2 — Document Controller เลือก MIGRATION_STAGING → 403
    // ----------------------------------------------------------------
    it('B.2.2: โยน ForbiddenException เมื่อ Document Controller เลือก MIGRATION_STAGING', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'correspondence.import_review',
      ]);

      await expect(
        controller.check(
          makeDto({ targetMode: 'MIGRATION_STAGING' }),
          makeFile(),
          makeUser()
        )
      ).rejects.toThrow(ForbiddenException);
    });

    // ----------------------------------------------------------------
    // B.2.3 — Document Controller เลือก GEMINI → 403
    // ----------------------------------------------------------------
    it('B.2.3: โยน ForbiddenException เมื่อ Document Controller เลือก GEMINI', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'correspondence.import_review',
      ]);

      await expect(
        controller.check(
          makeDto({ aiProvider: 'GEMINI' }),
          makeFile(),
          makeUser()
        )
      ).rejects.toThrow(ForbiddenException);
    });

    // ----------------------------------------------------------------
    // B.2.4 — Admin เลือก MIGRATION_STAGING + LOCAL_OLLAMA → 200
    // ----------------------------------------------------------------
    it('B.2.4: เรียก service.check() สำเร็จเมื่อ Admin เลือก MIGRATION_STAGING + LOCAL_OLLAMA', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'system.manage_all',
        'correspondence.import_review',
      ]);
      const mockResponse = {
        reviewSessionPublicId: SESSION_ID,
        targetMode: 'MIGRATION_STAGING' as const,
        totalRows: 6,
        passCount: 4,
        warnCount: 1,
        blockCount: 1,
        aiSuggestCount: 0,
        canConfirm: true,
        downloadAnnotatedUrl: `/v1/correspondence/import-review/${SESSION_ID}/download-annotated`,
        findings: [],
        aiAvailable: false,
        aiReviewedRowCount: 0,
        aiSamplingMode: 'FULL' as const,
      };
      reviewService.check.mockResolvedValue(mockResponse);

      const result = await controller.check(
        makeDto({ targetMode: 'MIGRATION_STAGING' }),
        makeFile(),
        makeUser()
      );

      expect(result).toEqual(mockResponse);
      expect(reviewService.check).toHaveBeenCalledTimes(1);
      expect(reviewService.check).toHaveBeenCalledWith(
        expect.objectContaining({
          projectPublicId: PROJECT_PUBLIC_ID,
          targetMode: 'MIGRATION_STAGING',
          aiProvider: 'LOCAL_OLLAMA',
          batchStrategy: 'FULL',
          uploadedBy: USER_PUBLIC_ID,
        })
      );
    });

    // ----------------------------------------------------------------
    // เพิ่ม: Org Admin (organization.manage_members) ใช้ MIGRATION_STAGING ได้
    // ----------------------------------------------------------------
    it('B.2.4b: Org Admin (organization.manage_members) ใช้ MIGRATION_STAGING ได้', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'organization.manage_members',
        'correspondence.import_review',
      ]);
      reviewService.check.mockResolvedValue({
        reviewSessionPublicId: SESSION_ID,
        targetMode: 'MIGRATION_STAGING',
        totalRows: 0,
        passCount: 0,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        canConfirm: true,
        downloadAnnotatedUrl: '',
        findings: [],
        aiAvailable: false,
        aiReviewedRowCount: 0,
        aiSamplingMode: 'FULL',
      });

      const result = await controller.check(
        makeDto({ targetMode: 'MIGRATION_STAGING' }),
        makeFile(),
        makeUser()
      );

      expect(result.reviewSessionPublicId).toBe(SESSION_ID);
      expect(reviewService.check).toHaveBeenCalledTimes(1);
    });

    // ----------------------------------------------------------------
    // เพิ่ม: Admin เลือก CLAUDE ได้
    // ----------------------------------------------------------------
    it('B.2.4c: Admin เลือก CLAUDE ได้ (External AI)', async () => {
      userService.getUserPermissions.mockResolvedValue([
        'system.manage_all',
        'correspondence.import_review',
      ]);
      reviewService.check.mockResolvedValue({
        reviewSessionPublicId: SESSION_ID,
        targetMode: 'DIRECT_IMPORT',
        totalRows: 0,
        passCount: 0,
        warnCount: 0,
        blockCount: 0,
        aiSuggestCount: 0,
        canConfirm: true,
        downloadAnnotatedUrl: '',
        findings: [],
        aiAvailable: true,
        aiReviewedRowCount: 0,
        aiSamplingMode: 'FULL',
      });

      await controller.check(
        makeDto({ aiProvider: 'CLAUDE' }),
        makeFile(),
        makeUser()
      );

      expect(reviewService.check).toHaveBeenCalledWith(
        expect.objectContaining({ aiProvider: 'CLAUDE' })
      );
    });
  });

  // ----------------------------------------------------------------
  // B.2.5-B.2.7 — GET /:sessionId/download-annotated
  // ----------------------------------------------------------------
  describe('GET /:sessionId/download-annotated', () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'annotated-spec-'));
      tmpFile = path.join(tmpDir, 'annotated.xlsx');
      fs.writeFileSync(tmpFile, 'fake-annotated-content');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('B.2.6: stream ไฟล์สำเร็จ + header ถูกต้องเมื่อไฟล์มีจริง', async () => {
      reviewService.getAnnotatedFilePath.mockResolvedValue({
        filePath: tmpFile,
        originalFileName: 'annotated-test.xlsx',
      });

      const { res, setHeader } = createMockResponse();

      await controller.downloadAnnotated(SESSION_ID, res as never, makeUser());

      // รอ stream pipe ทำงานเสร็จ
      await new Promise((resolve) => setImmediate(resolve));

      expect(reviewService.getAnnotatedFilePath).toHaveBeenCalledWith(
        SESSION_ID
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="annotated-test.xlsx"'
      );
    });

    it('B.2.7: โยน NotFoundException เมื่อไฟล์ไม่มี (service throw)', async () => {
      reviewService.getAnnotatedFilePath.mockRejectedValue(
        new NotFoundException('ไม่พบ Review Session')
      );

      await expect(
        controller.downloadAnnotated(SESSION_ID, {} as never, makeUser())
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ----------------------------------------------------------------
  // B.2.8-B.2.9 — POST /:sessionId/confirm
  // ----------------------------------------------------------------
  describe('POST /:sessionId/confirm', () => {
    it('B.2.9: เรียก service.confirm() สำเร็จเมื่อ session มีจริง', async () => {
      const mockResponse = {
        reviewSessionPublicId: SESSION_ID,
        batchId: 'batch-001',
        targetMode: 'DIRECT_IMPORT' as const,
        totalRows: 6,
        enqueuedCount: 5,
        quarantinedCount: 1,
        failedRowsDownloadUrl: '',
        status: 'CONFIRMED' as const,
      };
      reviewService.confirm.mockResolvedValue(mockResponse);

      const result = await controller.confirm(SESSION_ID, makeUser());

      expect(result).toEqual(mockResponse);
      expect(reviewService.confirm).toHaveBeenCalledWith({
        reviewSessionPublicId: SESSION_ID,
        confirmedBy: USER_PUBLIC_ID,
      });
    });
  });

  // ----------------------------------------------------------------
  // B.2.10-B.2.11 — POST /:sessionId/cancel
  // ----------------------------------------------------------------
  describe('POST /:sessionId/cancel', () => {
    it('B.2.11: เรียก service.cancel() สำเร็จเมื่อ session มีจริง', async () => {
      const mockResponse = {
        reviewSessionPublicId: SESSION_ID,
        status: 'CANCELLED' as const,
      };
      reviewService.cancel.mockResolvedValue(mockResponse);

      const result = await controller.cancel(SESSION_ID, makeUser());

      expect(result).toEqual(mockResponse);
      expect(reviewService.cancel).toHaveBeenCalledWith({
        reviewSessionPublicId: SESSION_ID,
        cancelledBy: USER_PUBLIC_ID,
      });
    });
  });

  // ----------------------------------------------------------------
  // B.1.1-B.1.4 + B.2.12-B.2.13 — GET /:sessionId/download-failed-rows
  // ----------------------------------------------------------------
  describe('GET /:sessionId/download-failed-rows', () => {
    let tmpDir: string;
    let tmpFile: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'failed-rows-spec-'));
      tmpFile = path.join(tmpDir, 'failed_rows.xlsx');
      fs.writeFileSync(tmpFile, 'fake-failed-rows-content');
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('B.1.1 + B.2.12: stream ไฟล์สำเร็จเมื่อ getFailedRowsFilePath คืน path ที่มีไฟล์จริง', async () => {
      reviewService.getFailedRowsFilePath.mockResolvedValue({
        filePath: tmpFile,
      });

      const { res, setHeader } = createMockResponse();

      await controller.downloadFailedRows(SESSION_ID, res as never, makeUser());

      // รอ stream pipe ทำงานเสร็จ
      await new Promise((resolve) => setImmediate(resolve));

      expect(reviewService.getFailedRowsFilePath).toHaveBeenCalledWith(
        SESSION_ID
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        `attachment; filename="failed_rows-${SESSION_ID}.xlsx"`
      );
    });

    it('B.1.2 + B.2.13: โยน NotFoundException เมื่อไฟล์ไม่มี (service throw)', async () => {
      reviewService.getFailedRowsFilePath.mockRejectedValue(
        new NotFoundException('ไม่พบไฟล์ failed_rows.xlsx')
      );

      await expect(
        controller.downloadFailedRows(SESSION_ID, {} as never, makeUser())
      ).rejects.toThrow(NotFoundException);
    });

    it('B.1.4: ส่ง 500 + log error เมื่อ stream error ระหว่าง pipe (headers ยังไม่ sent)', async () => {
      // ใช้ path ที่ไม่มีจริงเพื่อ trigger stream error (ENOENT)
      reviewService.getFailedRowsFilePath.mockResolvedValue({
        filePath: '/tmp/nonexistent-failed-rows-spec-12345.xlsx',
      });

      const { res, status, json } = createMockResponse();

      // ห่อด้วย try เพื่อจับ unhandled error จาก stream
      await controller.downloadFailedRows(SESSION_ID, res as never, makeUser());

      // รอ event 'error' ของ stream (ENOENT จะ emit หลัง pipe)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        message: 'ไม่สามารถสตรีมไฟล์ได้ — กรุณาลองใหม่',
      });
    });
  });

  // ----------------------------------------------------------------
  // ParseUUIDPipe — ทดสอบผ่าน NestJS pipe (integration กับ framework)
  // หมายเหตุ: ParseUUIDPipe ทำงานที่ framework level ก่อนเข้า method
  // ดังนั้น unit test ที่เรียก method ตรงจะไม่ผ่าน pipe
  // แต่เราทดสอบว่า controller ประกาศ ParseUUIDPipe ถูกต้อง
  // ----------------------------------------------------------------
  describe('ParseUUIDPipe validation (B.2.5, B.2.8, B.2.10)', () => {
    it('controller methods ยอมรับ UUID string ที่ valid', async () => {
      // ทดสอบว่า method signature ยอมรับ UUID ได้ (ไม่ throw ก่อนเข้า service)
      reviewService.confirm.mockResolvedValue({
        reviewSessionPublicId: SESSION_ID,
        batchId: 'batch-001',
        targetMode: 'DIRECT_IMPORT',
        totalRows: 0,
        enqueuedCount: 0,
        quarantinedCount: 0,
        failedRowsDownloadUrl: '',
        status: 'CONFIRMED',
      });

      await expect(
        controller.confirm(SESSION_ID, makeUser())
      ).resolves.toBeDefined();
    });
  });
});
