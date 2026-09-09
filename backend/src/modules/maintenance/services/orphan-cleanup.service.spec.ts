// File: backend/src/modules/maintenance/services/orphan-cleanup.service.spec.ts
// Change Log:
// - 2026-09-09: Initial creation. Regression coverage for two production bugs found
//   live (backend logs, 2026-09-09 08:12 AM):
//   1. scanOrphans/purgeOrphans used `const fs = await import('fs-extra')` — fs-extra
//      is CJS, and Node's dynamic-import interop did not expose `readdir` on the
//      resulting namespace object, throwing "fs.readdir is not a function" on every
//      real call. Fixed by switching to the static `import * as fs from 'fs-extra'`
//      already used everywhere else in this codebase.
//   2. scanOrphans only read the top level of permanentDir with a single
//      fs.readdir() and skipped subdirectories — but permanentDir stores files at
//      {docType}/{YYYY}/{MM}/filename (see migration-review.service.ts), so it could
//      never find any real orphan. Fixed with a recursive walkFiles() helper.

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrphanCleanupService } from './orphan-cleanup.service';
import { FileStorageService } from '../../../common/file-storage/file-storage.service';

const DEFAULT_REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

jest.mock('fs-extra', () => ({
  pathExists: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  remove: jest.fn(),
}));

const mockedFs = jest.requireMock('fs-extra') as unknown as {
  pathExists: jest.Mock;
  readdir: jest.Mock;
  stat: jest.Mock;
  remove: jest.Mock;
};

describe('OrphanCleanupService', () => {
  let service: OrphanCleanupService;
  let dataSource: { query: jest.Mock };

  const PERMANENT_DIR = '/uploads/permanent';
  const TEMP_DIR = '/uploads/temp';

  beforeEach(async () => {
    jest.clearAllMocks();

    dataSource = { query: jest.fn().mockResolvedValue([]) };

    const mockFileStorageService = {
      permanentDir: PERMANENT_DIR,
      tempDir: TEMP_DIR,
    } as unknown as FileStorageService;

    const mockRedis = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrphanCleanupService,
        { provide: DataSource, useValue: dataSource },
        { provide: FileStorageService, useValue: mockFileStorageService },
        { provide: DEFAULT_REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<OrphanCleanupService>(OrphanCleanupService);
  });

  describe('scanOrphans', () => {
    it('descends into nested {docType}/{year}/{month} directories (regression: non-recursive readdir bug)', async () => {
      // permanentDir/LETTER/2026/09/file.pdf — 3 levels deep, matches real storage layout
      mockedFs.pathExists.mockImplementation((p: string) =>
        Promise.resolve(p === PERMANENT_DIR || p === TEMP_DIR)
      );
      mockedFs.readdir.mockImplementation((dir: string) => {
        if (dir === PERMANENT_DIR) return Promise.resolve(['LETTER']);
        if (dir === `${PERMANENT_DIR}/LETTER`) return Promise.resolve(['2026']);
        if (dir === `${PERMANENT_DIR}/LETTER/2026`)
          return Promise.resolve(['09']);
        if (dir === `${PERMANENT_DIR}/LETTER/2026/09`)
          return Promise.resolve(['file.pdf']);
        if (dir === TEMP_DIR) return Promise.resolve([]);
        return Promise.resolve([]);
      });
      mockedFs.stat.mockImplementation((p: string) =>
        Promise.resolve({
          isDirectory: () => !p.endsWith('.pdf'),
          size: 1234,
          mtime: new Date('2026-09-01'),
        })
      );
      dataSource.query.mockResolvedValue([]); // no matching attachment -> orphan

      const result = await service.scanOrphans();

      expect(result).toEqual([
        {
          path: `${PERMANENT_DIR}/LETTER/2026/09/file.pdf`,
          sizeBytes: 1234,
          lastModified: new Date('2026-09-01'),
          reason: 'NO_ATTACHMENT_RECORD',
        },
      ]);
    });

    it('excludes files that have a matching attachment record', async () => {
      mockedFs.pathExists.mockImplementation((p: string) =>
        Promise.resolve(p === TEMP_DIR)
      );
      mockedFs.readdir.mockImplementation((dir: string) =>
        dir === TEMP_DIR ? Promise.resolve(['known.pdf']) : Promise.resolve([])
      );
      mockedFs.stat.mockResolvedValue({
        isDirectory: () => false,
        size: 10,
        mtime: new Date(),
      });
      dataSource.query.mockResolvedValue([{ id: 1 }]); // matching attachment found

      const result = await service.scanOrphans();

      expect(result).toEqual([]);
    });

    it('skips directories that do not exist', async () => {
      mockedFs.pathExists.mockResolvedValue(false);

      const result = await service.scanOrphans();

      expect(result).toEqual([]);
      expect(mockedFs.readdir).not.toHaveBeenCalled();
    });
  });
});
