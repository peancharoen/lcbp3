// File: backend/src/modules/migration/services/review-session-stash.service.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ ReviewSessionStashService
//   (T005, FR-012 Redis 24h TTL + disk stash + cleanup) ตาม TDD RED ก่อน implement

import { Test } from '@nestjs/testing';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ReviewSessionStashService,
  REVIEW_STAGING_ROOT_TOKEN,
  CreateReviewSessionInput,
} from './review-session-stash.service';
import {
  REVIEW_SESSION_REDIS_PREFIX,
  REVIEW_SESSION_TTL_SECONDS,
} from '../types/excel-review.types';

/** RegExp ตรวจ UUID string format (ADR-019 — ใช้เป็น string เท่านั้น) */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('ReviewSessionStashService', () => {
  let service: ReviewSessionStashService;
  let redis: jest.Mocked<Redis>;
  let stagingRoot: string;

  const makeInput = (): CreateReviewSessionInput => ({
    projectPublicId: '019505a1-7c3e-7000-8000-abc123def456',
    targetMode: 'MIGRATION_STAGING',
    uploadedBy: '019505a1-7c3e-7000-8000-fedcba987654',
    selectedAiProvider: 'LOCAL_OLLAMA',
    originalFileName: 'register.xlsx',
    fileBuffer: Buffer.from('fake-xlsx-content-for-spec'),
    totalRows: 20,
    passCount: 15,
    warnCount: 3,
    blockCount: 2,
    aiSuggestCount: 0,
  });

  beforeEach(async () => {
    redis = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      exists: jest.fn().mockResolvedValue(1),
    } as unknown as jest.Mocked<Redis>;

    stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'review-stash-spec-'));

    const module = await Test.createTestingModule({
      providers: [
        ReviewSessionStashService,
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
        { provide: REVIEW_STAGING_ROOT_TOKEN, useValue: stagingRoot },
      ],
    }).compile();

    service = module.get<ReviewSessionStashService>(ReviewSessionStashService);
  });

  afterEach(() => {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
  });

  describe('createSession', () => {
    it('สร้าง session พร้อม reviewSessionPublicId เป็น UUID string และ status READY', async () => {
      const result = await service.createSession(makeInput());

      expect(typeof result.reviewSessionPublicId).toBe('string');
      expect(result.reviewSessionPublicId).toMatch(UUID_PATTERN);
      expect(result.status).toBe('READY');
      expect(result.projectPublicId).toBe(
        '019505a1-7c3e-7000-8000-abc123def456'
      );
      expect(result.targetMode).toBe('MIGRATION_STAGING');
      expect(result.selectedAiProvider).toBe('LOCAL_OLLAMA');
    });

    it('คัดลอก counter จาก input และตั้ง annotatedFilePath ว่างไว้ก่อน', async () => {
      const result = await service.createSession(makeInput());

      expect(result.totalRows).toBe(20);
      expect(result.passCount).toBe(15);
      expect(result.warnCount).toBe(3);
      expect(result.blockCount).toBe(2);
      expect(result.aiSuggestCount).toBe(0);
      expect(result.annotatedFilePath).toBe('');
    });

    it('คำนวณ expiresAt = createdAt + 24 ชั่วโมง (ISO strings)', async () => {
      const result = await service.createSession(makeInput());

      const created = new Date(result.createdAt).getTime();
      const expires = new Date(result.expiresAt).getTime();
      expect(expires - created).toBe(REVIEW_SESSION_TTL_SECONDS * 1000);
      expect(isNaN(created)).toBe(false);
    });

    it('เขียนไฟล์ที่อัปโหลดลง stash directory ส่วนตัวของ session', async () => {
      const input = makeInput();
      const result = await service.createSession(input);

      const sessionDir = path.join(
        stagingRoot,
        'import-review',
        result.reviewSessionPublicId
      );
      const storedPath = path.join(sessionDir, 'register.xlsx');
      expect(fs.existsSync(storedPath)).toBe(true);
      expect(fs.readFileSync(storedPath).toString()).toBe(
        'fake-xlsx-content-for-spec'
      );
      expect(result.originalFilePath).toBe(storedPath);
      expect(result.originalFileName).toBe('register.xlsx');
    });

    it('บันทึก JSON ลง Redis ด้วย TTL 24 ชั่วโมงตาม prefix ที่กำหนด', async () => {
      const result = await service.createSession(makeInput());

      const expectedKey =
        REVIEW_SESSION_REDIS_PREFIX + result.reviewSessionPublicId;
      expect(redis.set).toHaveBeenCalledWith(
        expectedKey,
        JSON.stringify(result),
        'EX',
        REVIEW_SESSION_TTL_SECONDS
      );
      expect(REVIEW_SESSION_TTL_SECONDS).toBe(86400);
    });

    it('sanitize ชื่อไฟล์ที่มี path traversal (../../) กันเขียนหลุดออกนอก stash', async () => {
      const input = makeInput();
      input.originalFileName = '..\\..\\evil.xlsx';
      const result = await service.createSession(input);

      const sessionDir = path.join(
        stagingRoot,
        'import-review',
        result.reviewSessionPublicId
      );
      // ชื่อไฟล์ที่เก็บต้องเป็น basename เท่านั้น
      expect(result.originalFileName).toBe('evil.xlsx');
      expect(result.originalFilePath).toBe(path.join(sessionDir, 'evil.xlsx'));
      expect(fs.existsSync(path.join(sessionDir, 'evil.xlsx'))).toBe(true);
      // ต้องไม่มีไฟล์ถูกสร้างนอก stagingRoot
      expect(fs.readdirSync(stagingRoot)).toEqual(['import-review']);
    });
  });

  describe('getSession', () => {
    it('คืน ReviewSessionData เมื่อ Redis มี JSON ที่ valid', async () => {
      const created = await service.createSession(makeInput());
      redis.get.mockResolvedValue(JSON.stringify(created));

      const fetched = await service.getSession(created.reviewSessionPublicId);

      expect(fetched).toEqual(created);
      expect(redis.get).toHaveBeenCalledWith(
        REVIEW_SESSION_REDIS_PREFIX + created.reviewSessionPublicId
      );
    });

    it('คืน null เมื่อ Redis ไม่มีคีย์ (session หมดอายุ/ไม่มีอยู่)', async () => {
      redis.get.mockResolvedValue(null);

      const fetched = await service.getSession(
        '019505a1-0000-7000-8000-000000000001'
      );

      expect(fetched).toBeNull();
    });

    it('คืน null เมื่อ JSON ใน Redis เสียหาย (try/catch JSON.parse)', async () => {
      redis.get.mockResolvedValue('not-json{{{');

      const fetched = await service.getSession(
        '019505a1-0000-7000-8000-000000000002'
      );

      expect(fetched).toBeNull();
    });

    it('คืน null เมื่อ JSON มี shape ไม่ตรง ReviewSessionData', async () => {
      redis.get.mockResolvedValue(JSON.stringify({ foo: 'bar', baz: 42 }));

      const fetched = await service.getSession(
        '019505a1-0000-7000-8000-000000000003'
      );

      expect(fetched).toBeNull();
    });
  });

  describe('deleteSession', () => {
    it('ลบทั้ง Redis key และ stash directory ของ session', async () => {
      const created = await service.createSession(makeInput());
      const sessionDir = path.join(
        stagingRoot,
        'import-review',
        created.reviewSessionPublicId
      );
      expect(fs.existsSync(sessionDir)).toBe(true);

      await service.deleteSession(created.reviewSessionPublicId);

      expect(fs.existsSync(sessionDir)).toBe(false);
      expect(redis.del).toHaveBeenCalledWith(
        REVIEW_SESSION_REDIS_PREFIX + created.reviewSessionPublicId
      );
    });

    it('เป็น idempotent — เรียกซ้ำหลังลบไปแล้วต้องไม่ throw', async () => {
      const created = await service.createSession(makeInput());

      await service.deleteSession(created.reviewSessionPublicId);
      await expect(
        service.deleteSession(created.reviewSessionPublicId)
      ).resolves.toBeUndefined();
    });

    it('ไม่ throw เมื่อลบ session ที่ไม่เคยมีอยู่', async () => {
      await expect(
        service.deleteSession('019505a1-0000-7000-8000-000000000004')
      ).resolves.toBeUndefined();
      expect(redis.del).toHaveBeenCalledWith(
        REVIEW_SESSION_REDIS_PREFIX + '019505a1-0000-7000-8000-000000000004'
      );
    });
  });

  describe('listExpiredStashDirs', () => {
    it('คืน absolute path ของ directory ที่ Redis key ไม่มีอยู่แล้ว', async () => {
      const sessionsRoot = path.join(stagingRoot, 'import-review');
      fs.mkdirSync(
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000aa'),
        { recursive: true }
      );
      fs.mkdirSync(
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000bb'),
        { recursive: true }
      );

      redis.exists.mockImplementation(((key: string) =>
        Promise.resolve(
          key.endsWith('0000000000aa') ? 1 : 0
        )) as unknown as typeof redis.exists);

      const expired = await service.listExpiredStashDirs();

      expect(expired).toEqual([
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000bb'),
      ]);
    });

    it('คืน [] เมื่อยังไม่มี stash root ใน filesystem เลย', async () => {
      const freshRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), 'review-stash-empty-')
      );
      fs.rmSync(freshRoot, { recursive: true, force: true });
      const module = await Test.createTestingModule({
        providers: [
          ReviewSessionStashService,
          { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
          { provide: REVIEW_STAGING_ROOT_TOKEN, useValue: freshRoot },
        ],
      }).compile();
      const freshService = module.get<ReviewSessionStashService>(
        ReviewSessionStashService
      );

      const expired = await freshService.listExpiredStashDirs();

      expect(expired).toEqual([]);
    });

    it('ข้ามรายการที่ไม่ใช่ directory (ไฟล์ธรรมดาใน sessions root)', async () => {
      const sessionsRoot = path.join(stagingRoot, 'import-review');
      fs.mkdirSync(sessionsRoot, { recursive: true });
      fs.writeFileSync(path.join(sessionsRoot, 'stray-file.txt'), 'junk');
      fs.mkdirSync(
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000cc')
      );

      redis.exists.mockResolvedValue(0);

      const expired = await service.listExpiredStashDirs();

      expect(expired).toEqual([
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000cc'),
      ]);
    });

    it('SKIP directory เมื่อ Redis exists() throw (outage safety)', async () => {
      const sessionsRoot = path.join(stagingRoot, 'import-review');
      fs.mkdirSync(
        path.join(sessionsRoot, '019505a1-0000-7000-8000-0000000000dd'),
        { recursive: true }
      );

      redis.exists.mockRejectedValue(new Error('Redis connection refused'));

      const expired = await service.listExpiredStashDirs();

      // ต้องไม่คืน directory เพื่อป้องกันการลบ active sessions
      expect(expired).toEqual([]);
    });

    it('คืน [] เมื่อ readdir ล้มเหลว', async () => {
      const sessionsRoot = path.join(stagingRoot, 'import-review');
      fs.mkdirSync(sessionsRoot, { recursive: true });

      // ทำให้ readdir ล้มเหลวโดยลบ directory ระหว่างทางไม่ได้ง่าย
      // ใช้วิธี mock fs.promises.readdir ผ่าน jest.spyOn
      const readdirSpy = jest
        .spyOn(fs.promises, 'readdir')
        .mockRejectedValue(new Error('Permission denied'));

      const expired = await service.listExpiredStashDirs();

      expect(expired).toEqual([]);
      readdirSpy.mockRestore();
    });
  });

  describe('updateAnnotatedPath', () => {
    it('อัปเดต annotatedFilePath และบันทึกลง Redis', async () => {
      const created = await service.createSession(makeInput());
      redis.get.mockResolvedValue(JSON.stringify(created));

      const updated = await service.updateAnnotatedPath(
        created.reviewSessionPublicId,
        '/tmp/annotated.xlsx'
      );

      expect(updated).not.toBeNull();
      expect(updated!.annotatedFilePath).toBe('/tmp/annotated.xlsx');
      expect(updated!.reviewSessionPublicId).toBe(
        created.reviewSessionPublicId
      );
      expect(redis.set).toHaveBeenCalledWith(
        REVIEW_SESSION_REDIS_PREFIX + created.reviewSessionPublicId,
        JSON.stringify(updated),
        'EX',
        REVIEW_SESSION_TTL_SECONDS
      );
    });

    it('คืน null เมื่อ session ไม่มีอยู่', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.updateAnnotatedPath(
        '019505a1-0000-7000-8000-000000000099',
        '/tmp/annotated.xlsx'
      );

      expect(result).toBeNull();
    });
  });

  describe('updateFailedRowsPath', () => {
    it('อัปเดต failedRowsFilePath และบันทึกลง Redis', async () => {
      const created = await service.createSession(makeInput());
      redis.get.mockResolvedValue(JSON.stringify(created));

      const updated = await service.updateFailedRowsPath(
        created.reviewSessionPublicId,
        '/tmp/failed_rows.xlsx'
      );

      expect(updated).not.toBeNull();
      expect(updated!.failedRowsFilePath).toBe('/tmp/failed_rows.xlsx');
      expect(redis.set).toHaveBeenCalledWith(
        REVIEW_SESSION_REDIS_PREFIX + created.reviewSessionPublicId,
        JSON.stringify(updated),
        'EX',
        REVIEW_SESSION_TTL_SECONDS
      );
    });

    it('คืน null เมื่อ session ไม่มีอยู่', async () => {
      redis.get.mockResolvedValue(null);

      const result = await service.updateFailedRowsPath(
        '019505a1-0000-7000-8000-000000000098',
        '/tmp/failed_rows.xlsx'
      );

      expect(result).toBeNull();
    });
  });

  describe('deleteSession — error paths', () => {
    it('ไม่ throw เมื่อ Redis del ล้มเหลว (log + ทำต่อ)', async () => {
      const created = await service.createSession(makeInput());
      redis.del.mockRejectedValue(new Error('Redis connection lost'));

      await expect(
        service.deleteSession(created.reviewSessionPublicId)
      ).resolves.toBeUndefined();
    });

    it('ไม่ throw เมื่อ rm stash dir ล้มเหลว', async () => {
      const created = await service.createSession(makeInput());
      const rmSpy = jest
        .spyOn(fs.promises, 'rm')
        .mockRejectedValue(new Error('Permission denied'));

      await expect(
        service.deleteSession(created.reviewSessionPublicId)
      ).resolves.toBeUndefined();

      rmSpy.mockRestore();
    });
  });

  describe('sanitizeFileName — edge cases (via createSession)', () => {
    it('แปลงชื่อไฟล์ที่เป็นจุดเดียวเป็น unnamed-upload.bin', async () => {
      const input = makeInput();
      input.originalFileName = '.';
      const result = await service.createSession(input);

      expect(result.originalFileName).toBe('unnamed-upload.bin');
    });

    it('แปลงชื่อไฟล์ที่เป็นจุดสองจุดเป็น unnamed-upload.bin', async () => {
      const input = makeInput();
      input.originalFileName = '..';
      const result = await service.createSession(input);

      expect(result.originalFileName).toBe('unnamed-upload.bin');
    });

    it('แปลงชื่อไฟล์ว่างเป็น unnamed-upload.bin', async () => {
      const input = makeInput();
      input.originalFileName = '';
      const result = await service.createSession(input);

      expect(result.originalFileName).toBe('unnamed-upload.bin');
    });
  });

  describe('getSession — shape validation edge cases', () => {
    it('คืน null เมื่อ targetMode ไม่ใช่ enum ที่ถูกต้อง', async () => {
      const created = await service.createSession(makeInput());
      const badSession = { ...created, targetMode: 'INVALID_MODE' };
      redis.get.mockResolvedValue(JSON.stringify(badSession));

      const result = await service.getSession(created.reviewSessionPublicId);

      expect(result).toBeNull();
    });

    it('คืน null เมื่อ selectedAiProvider ไม่ใช่ enum ที่ถูกต้อง', async () => {
      const created = await service.createSession(makeInput());
      const badSession = { ...created, selectedAiProvider: 'CHATGPT' };
      redis.get.mockResolvedValue(JSON.stringify(badSession));

      const result = await service.getSession(created.reviewSessionPublicId);

      expect(result).toBeNull();
    });

    it('คืน null เมื่อ value เป็น null', async () => {
      redis.get.mockResolvedValue('null');

      const result = await service.getSession(
        '019505a1-0000-7000-8000-000000000077'
      );

      expect(result).toBeNull();
    });

    it('ยอมรับ session ที่ไม่มี failedRowsFilePath (backward compat)', async () => {
      const created = await service.createSession(makeInput());
      // ลบ failedRowsFilePath ออกเพื่อจำลอง session เก่า
      const { failedRowsFilePath, ...legacySession } = created;
      void failedRowsFilePath;
      redis.get.mockResolvedValue(JSON.stringify(legacySession));

      const result = await service.getSession(created.reviewSessionPublicId);

      expect(result).not.toBeNull();
      expect(result!.reviewSessionPublicId).toBe(created.reviewSessionPublicId);
    });
  });
});
