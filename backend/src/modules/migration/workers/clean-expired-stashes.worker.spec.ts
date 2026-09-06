// File: backend/src/modules/migration/workers/clean-expired-stashes.worker.spec.ts
// Change Log:
// - 2026-09-06: Initial creation — unit test สำหรับ CleanExpiredStashesWorker
//   (T023, FR-016, D5 — coverage target ≥70%)

import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CleanExpiredStashesWorker } from './clean-expired-stashes.worker';
import { ReviewSessionStashService } from '../services/review-session-stash.service';

describe('CleanExpiredStashesWorker', () => {
  let worker: CleanExpiredStashesWorker;
  let stashService: jest.Mocked<ReviewSessionStashService>;
  let tmpRoot: string;

  beforeEach(async () => {
    stashService = {
      listExpiredStashDirs: jest.fn(),
    } as unknown as jest.Mocked<ReviewSessionStashService>;

    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'clean-stash-worker-'));

    const module = await Test.createTestingModule({
      providers: [
        CleanExpiredStashesWorker,
        { provide: ReviewSessionStashService, useValue: stashService },
      ],
    }).compile();

    worker = module.get<CleanExpiredStashesWorker>(CleanExpiredStashesWorker);
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  describe('handleExpiredStashCleanup', () => {
    it('log และ return เมื่อไม่มี expired directories', async () => {
      stashService.listExpiredStashDirs.mockResolvedValue([]);

      await worker.handleExpiredStashCleanup();

      expect(stashService.listExpiredStashDirs).toHaveBeenCalledTimes(1);
    });

    it('ลบ expired directories ทั้งหมด', async () => {
      const dir1 = path.join(tmpRoot, 'session-aaa');
      const dir2 = path.join(tmpRoot, 'session-bbb');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });
      fs.writeFileSync(path.join(dir1, 'file.txt'), 'content');

      stashService.listExpiredStashDirs.mockResolvedValue([dir1, dir2]);

      await worker.handleExpiredStashCleanup();

      expect(fs.existsSync(dir1)).toBe(false);
      expect(fs.existsSync(dir2)).toBe(false);
    });

    it('ลบ directory ที่ไม่มีอยู่จริงได้ (force: true)', async () => {
      const dir1 = path.join(tmpRoot, 'session-ok');
      const dir2 = path.join(tmpRoot, 'session-nonexistent');
      fs.mkdirSync(dir1, { recursive: true });

      stashService.listExpiredStashDirs.mockResolvedValue([dir1, dir2]);

      await worker.handleExpiredStashCleanup();

      expect(fs.existsSync(dir1)).toBe(false);
    });

    it('ไม่ throw เมื่อ rm directory หนึ่งล้มเหลว — ทำต่อ', async () => {
      const dir1 = path.join(tmpRoot, 'session-ok');
      const dir2 = path.join(tmpRoot, 'session-fail');
      fs.mkdirSync(dir1, { recursive: true });
      fs.mkdirSync(dir2, { recursive: true });

      const originalRm = fs.promises.rm;
      const rmSpy = jest
        .spyOn(fs.promises, 'rm')
        .mockImplementation(async (p, opts) => {
          if (p === dir2) {
            throw new Error('Permission denied');
          }
          return originalRm(p, opts as unknown as fs.RmOptions);
        });

      stashService.listExpiredStashDirs.mockResolvedValue([dir1, dir2]);

      await worker.handleExpiredStashCleanup();

      expect(fs.existsSync(dir1)).toBe(false);
      expect(fs.existsSync(dir2)).toBe(true);
      rmSpy.mockRestore();
    });

    it('ไม่ throw เมื่อ listExpiredStashDirs throw — catch ระดับนอกสุด', async () => {
      stashService.listExpiredStashDirs.mockRejectedValue(
        new Error('Redis connection lost')
      );

      await expect(worker.handleExpiredStashCleanup()).resolves.toBeUndefined();
    });

    it('ลบ directory ที่มีไฟล์ย่อย (recursive)', async () => {
      const dir = path.join(tmpRoot, 'session-with-files');
      fs.mkdirSync(path.join(dir, 'subdir'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'file1.txt'), 'content1');
      fs.writeFileSync(path.join(dir, 'subdir', 'file2.txt'), 'content2');

      stashService.listExpiredStashDirs.mockResolvedValue([dir]);

      await worker.handleExpiredStashCleanup();

      expect(fs.existsSync(dir)).toBe(false);
    });
  });
});
