// File: backend/src/modules/ai/tests/vram-monitor.service.spec.ts
// Change Log:
// - 2026-06-11: สร้าง unit tests สำหรับ VramMonitorService (US5)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VramMonitorService } from '../services/vram-monitor.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VramMonitorService', () => {
  let service: VramMonitorService;
  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: unknown): unknown => {
      const config: Record<string, unknown> = {
        OLLAMA_URL: 'http://localhost:11434',
        GPU_TOTAL_VRAM_MB: 8192, // mock total 8GB
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VramMonitorService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<VramMonitorService>(VramMonitorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getVramHeadroom', () => {
    it('ควรคำนวณ headroom ถูกต้องเมื่อ Ollama คืนข้อมูลโมเดลปกติ', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'typhoon2.5-np-dms:latest',
              size_vram: 4 * 1024 * 1024 * 1024,
            }, // 4GB
            { name: 'other-model', size_vram: 2 * 1024 * 1024 * 1024 }, // 2GB
          ],
        },
      });
      const headroom = await service.getVramHeadroom();
      expect(headroom.querySuccess).toBe(true);
      expect(headroom.totalMb).toBe(8192);
      expect(headroom.usedMb).toBe(6144); // 4GB + 2GB = 6GB (6144MB)
      expect(headroom.availableMb).toBe(2048); // 8GB - 6GB = 2GB (2048MB)
      expect(headroom.mainModelVramMb).toBe(4096); // 4GB main model (4096MB)
    });

    it('ควรคำนวณ headroom เป็น safe default (0 available) เมื่อ Ollama query ล้มเหลว', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection timeout'));
      const headroom = await service.getVramHeadroom();
      expect(headroom.querySuccess).toBe(false);
      expect(headroom.availableMb).toBe(0);
      expect(headroom.usedMb).toBe(8192);
      expect(headroom.mainModelVramMb).toBe(0);
    });
  });

  describe('hasVramCapacity', () => {
    it('ควรคืน true เมื่อ headroom พอตามค่าที่ขอ', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'typhoon2.5-np-dms:latest',
              size_vram: 4 * 1024 * 1024 * 1024,
            },
          ],
        },
      });
      const result = await service.hasVramCapacity(3000); // query available is 4096MB
      expect(result).toBe(true);
    });

    it('ควรคืน false เมื่อ headroom ไม่พอตามค่าที่ขอ', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'typhoon2.5-np-dms:latest',
              size_vram: 6 * 1024 * 1024 * 1024,
            }, // 6GB used
          ],
        },
      });
      const result = await service.hasVramCapacity(3000); // query available is 2048MB, required 3000MB
      expect(result).toBe(false);
    });
  });
});
