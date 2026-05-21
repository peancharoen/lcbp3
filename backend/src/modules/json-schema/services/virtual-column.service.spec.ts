// File: src/modules/json-schema/services/virtual-column.service.spec.ts
// Change Log:
// - 2026-05-21: เพิ่ม unit tests สำหรับ VirtualColumnService

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { VirtualColumnService } from './virtual-column.service';
import { VirtualColumnConfig } from '../entities/json-schema.entity';

// Helper สร้าง mock QueryRunner
const makeQueryRunner = (tableExists = true, hasColumn = false) => ({
  connect: jest.fn().mockResolvedValue(undefined),
  release: jest.fn().mockResolvedValue(undefined),
  hasTable: jest.fn().mockResolvedValue(tableExists),
  hasColumn: jest.fn().mockResolvedValue(hasColumn),
  query: jest.fn().mockResolvedValue([{ count: 0 }]),
});

const makeDataSource = (qr: ReturnType<typeof makeQueryRunner>) =>
  ({
    createQueryRunner: jest.fn().mockReturnValue(qr),
  }) as unknown as DataSource;

const baseConfig: VirtualColumnConfig = {
  columnName: 'vc_discipline_code',
  jsonPath: '$.disciplineCode',
  dataType: 'VARCHAR',
  indexType: undefined,
};

describe('VirtualColumnService', () => {
  let service: VirtualColumnService;

  const buildService = async (ds: DataSource) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VirtualColumnService, { provide: DataSource, useValue: ds }],
    }).compile();
    return module.get<VirtualColumnService>(VirtualColumnService);
  };

  describe('setupVirtualColumns', () => {
    it('ควร return ทันทีเมื่อ configs ว่าง', async () => {
      const qr = makeQueryRunner();
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', []);
      expect(qr.connect).not.toHaveBeenCalled();
    });

    it('ควร return ทันทีเมื่อ configs เป็น null/undefined', async () => {
      const qr = makeQueryRunner();
      service = await buildService(makeDataSource(qr));

      await service.setupVirtualColumns('rfa_revisions', null as any);
      expect(qr.connect).not.toHaveBeenCalled();
    });

    it('ควร skip เมื่อ table ไม่มีอยู่ใน DB', async () => {
      const qr = makeQueryRunner(false); // tableExists=false
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('nonexistent_table', [baseConfig]);
      expect(qr.hasTable).toHaveBeenCalledWith('nonexistent_table');
      expect(qr.hasColumn).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalled();
    });

    it('ควรสร้าง virtual column เมื่อ column ยังไม่มี', async () => {
      const qr = makeQueryRunner(true, false); // column ยังไม่มี
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', [baseConfig]);
      // ควรเรียก query สร้าง column
      expect(qr.query).toHaveBeenCalledWith(
        expect.stringContaining('ADD COLUMN vc_discipline_code')
      );
      expect(qr.release).toHaveBeenCalled();
    });

    it('ควรไม่สร้าง column ซ้ำเมื่อ column มีอยู่แล้ว', async () => {
      const qr = makeQueryRunner(true, true); // column มีอยู่แล้ว
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', [baseConfig]);
      // query ถูกเรียก 0 ครั้ง (ไม่สร้างซ้ำ)
      expect(qr.query).not.toHaveBeenCalled();
    });

    it('ควรสร้าง index เมื่อ config มี indexType และ index ยังไม่มี', async () => {
      const qr = makeQueryRunner(true, false);
      qr.query
        .mockResolvedValueOnce(undefined) // ADD COLUMN
        .mockResolvedValueOnce([{ count: 0 }]) // check index — ยังไม่มี
        .mockResolvedValueOnce(undefined); // CREATE INDEX
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', [
        { ...baseConfig, indexType: 'BTREE' },
      ]);
      // ควรเรียก query 3 ครั้ง: ADD COLUMN, check index, CREATE INDEX
      expect(qr.query).toHaveBeenCalledTimes(3);
      const lastCall = qr.query.mock.calls[2][0] as string;
      expect(lastCall).toContain('CREATE');
      expect(lastCall).toContain('INDEX');
    });

    it('ควรสร้าง UNIQUE index เมื่อ indexType=UNIQUE', async () => {
      const qr = makeQueryRunner(true, false);
      qr.query
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce(undefined);
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', [
        { ...baseConfig, indexType: 'UNIQUE' },
      ]);
      const indexCall = qr.query.mock.calls[2][0] as string;
      expect(indexCall).toContain('UNIQUE');
    });

    it('ควรไม่สร้าง index ซ้ำเมื่อ index มีอยู่แล้ว', async () => {
      const qr = makeQueryRunner(true, false);
      qr.query
        .mockResolvedValueOnce(undefined) // ADD COLUMN
        .mockResolvedValueOnce([{ count: 1 }]); // index มีอยู่แล้ว
      service = await buildService(makeDataSource(qr));
      await service.setupVirtualColumns('rfa_revisions', [
        { ...baseConfig, indexType: 'BTREE' },
      ]);
      // ไม่ควรเรียก CREATE INDEX
      expect(qr.query).toHaveBeenCalledTimes(2);
    });

    it('ควร release queryRunner แม้จะ throw error', async () => {
      const qr = makeQueryRunner(true, false);
      qr.query.mockRejectedValueOnce(new Error('DB Error'));
      service = await buildService(makeDataSource(qr));
      await expect(
        service.setupVirtualColumns('rfa_revisions', [baseConfig])
      ).rejects.toThrow('DB Error');
      expect(qr.release).toHaveBeenCalled();
    });
  });

  describe('SQL generation — data type mapping', () => {
    const dataTypes: Array<[string, string]> = [
      ['INT', 'INT'],
      ['VARCHAR', 'VARCHAR(255)'],
      ['BOOLEAN', 'TINYINT(1)'],
      ['DATE', 'DATE'],
      ['DATETIME', 'DATETIME'],
      ['DECIMAL', 'DECIMAL(10,2)'],
      ['UNKNOWN_TYPE', 'VARCHAR(255)'], // default fallback
    ];

    for (const [input, expected] of dataTypes) {
      it(`ควร map dataType=${input} เป็น SQL type ${expected}`, async () => {
        const qr = makeQueryRunner(true, false);
        service = await buildService(makeDataSource(qr));
        await service.setupVirtualColumns('t', [
          {
            columnName: 'col',
            jsonPath: '$.x',
            dataType: input,
            indexType: undefined,
          },
        ]);
        const addColSql = qr.query.mock.calls[0][0] as string;
        expect(addColSql).toContain(expected);
      });
    }
  });
});
