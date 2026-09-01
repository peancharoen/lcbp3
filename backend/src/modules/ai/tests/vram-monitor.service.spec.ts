// File: backend/src/modules/ai/tests/vram-monitor.service.spec.ts
// Change Log:
// - 2026-06-11: สร้าง unit tests สำหรับ VramMonitorService (US5)
// - 2026-06-14: เพิ่ม tests สำหรับ getVramStatus และ invalidateCache เพื่อเพิ่ม branch/function coverage

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VramMonitorService } from '../services/vram-monitor.service';
import { OllamaService } from '../services/ollama.service';
import { AiQueueService } from '../ai-queue.service';
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

  const mockOllamaService = {
    loadModel: jest.fn().mockResolvedValue(undefined),
    unloadModel: jest.fn().mockResolvedValue(undefined),
    getMainKeepAliveSeconds: jest.fn().mockReturnValue(120),
  };

  const mockAiQueueService = {
    getBatchQueueSize: jest.fn().mockResolvedValue(0),
    getRealtimeQueueSize: jest.fn().mockResolvedValue(0),
    assertQueuesEmpty: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedis = {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    eval: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VramMonitorService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OllamaService, useValue: mockOllamaService },
        { provide: AiQueueService, useValue: mockAiQueueService },
        {
          provide: 'default_IORedisModuleConnectionToken',
          useValue: mockRedis,
        },
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
              name: 'np-dms-ai:latest',
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

    it('ควรคำนวณ headroom เป็น optimistic fallback (full available) เมื่อ Ollama query ล้มเหลว', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection timeout'));
      const headroom = await service.getVramHeadroom();
      expect(headroom.querySuccess).toBe(false);
      // เปลี่ยนจาก pessimistic เป็น optimistic: สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
      expect(headroom.availableMb).toBe(8192);
      expect(headroom.usedMb).toBe(0);
      expect(headroom.mainModelVramMb).toBe(0);
    });
  });

  describe('hasVramCapacity', () => {
    it('ควรคืน true เมื่อ headroom พอตามค่าที่ขอ', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
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
              name: 'np-dms-ai:latest',
              size_vram: 6 * 1024 * 1024 * 1024,
            }, // 6GB used
          ],
        },
      });
      const result = await service.hasVramCapacity(3000); // query available is 2048MB, required 3000MB
      expect(result).toBe(false);
    });

    it('ควรคืน true เมื่อไม่มีโมเดลโหลดอยู่เลย (ป้องกัน false positive)', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [], // ไม่มีโมเดลโหลด
        },
      });
      const result = await service.hasVramCapacity(5000); // ต้องการ 5GB แม้ availableMb = 8192MB
      expect(result).toBe(true);
    });

    it('ควรคืน true เมื่อ query ล้มเหลว (optimistic fallback)', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Connection timeout'));
      const result = await service.hasVramCapacity(5000);
      expect(result).toBe(true);
    });
  });
  describe('getVramStatus', () => {
    it('ควรคืน status ที่ถูกต้องเมื่อ Ollama คืน models', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          // first call: /api/ps ใน getVramStatus
          data: {
            models: [
              {
                name: 'np-dms-ai:latest',
                size: 5 * 1024 * 1024 * 1024,
                size_vram: 3 * 1024 * 1024 * 1024,
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          // second call: /api/ps ใน getVramHeadroom
          data: {
            models: [
              {
                name: 'np-dms-ai:latest',
                size: 5 * 1024 * 1024 * 1024,
                size_vram: 3 * 1024 * 1024 * 1024,
              },
            ],
          },
        });
      const status = await service.getVramStatus(4000);
      expect(status.loadedModels).toEqual([
        {
          modelId: 'np-dms-ai:latest',
          modelName: 'np-dms-ai:latest',
          vramUsageMB: 3072,
          modelSizeMB: 5120,
        },
      ]);
      expect(status.totalVramMb).toBe(8192);
      expect(status.hasCapacity).toBe(true); // 8192MB - 3072MB = 5120MB free > 4000MB required
    });
    it('ควรคืน hasCapacity=true เมื่อมี VRAM เหลือเพียงพอ', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            models: [
              { name: 'np-dms-ai:latest', size_vram: 1 * 1024 * 1024 * 1024 },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            models: [
              { name: 'np-dms-ai:latest', size_vram: 1 * 1024 * 1024 * 1024 },
            ],
          },
        });
      const status = await service.getVramStatus(4000);
      // 8192MB total - 1024MB used = 7168MB free > 4000MB
      expect(status.hasCapacity).toBe(true);
    });
    it('ควรคืน fallback optimistic (hasCapacity=true) เมื่อ /api/ps ล้มเหลว', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));
      const status = await service.getVramStatus();
      // เปลี่ยนจาก pessimistic เป็น optimistic: สมมติว่าไม่มี model load เมื่อ query ล้มเหลว
      expect(status.hasCapacity).toBe(true);
      expect(status.freeVramMb).toBe(8192); // total VRAM ทั้งหมด (8192MB default)
      expect(status.usedVramMb).toBe(0);
      expect(status.loadedModels).toEqual([]);
    });
  });
  describe('invalidateCache', () => {
    it('ควร resolve โดยไม่ throw (no-op)', async () => {
      await expect(service.invalidateCache()).resolves.toBeUndefined();
    });
  });

  // ─── ADR-048 FR-007: Global Empty-Queue Concurrency Guard ──────────────────

  describe('FR-007: loadModelVram empty-queue guard', () => {
    it('ควร reject load (409) เมื่อ ai-batch มี active/waiting jobs', async () => {
      mockAiQueueService.assertQueuesEmpty.mockRejectedValueOnce(
        new Error('Conflict')
      );
      await expect(service.loadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.loadModel).not.toHaveBeenCalled();
    });

    it('ควร reject load (409) เมื่อ ai-realtime มี active/waiting jobs', async () => {
      mockAiQueueService.assertQueuesEmpty.mockRejectedValueOnce(
        new Error('Conflict')
      );
      await expect(service.loadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.loadModel).not.toHaveBeenCalled();
    });

    it('ควรอนุญาต load เมื่อทั้งสอง queue ว่าง', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      // VRAM empty — no eviction needed
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });
      await service.loadModelVram('np-dms-ai:latest');
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest',
        120
      );
    });
  });

  describe('FR-007: unloadModelVram empty-queue guard (both queues)', () => {
    it('ควร reject unload (409) เมื่อ ai-realtime มี active/waiting jobs', async () => {
      mockAiQueueService.assertQueuesEmpty.mockRejectedValueOnce(
        new Error('Conflict')
      );
      await expect(service.unloadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
    });

    it('ควร reject unload (409) เมื่อ ai-batch มี active/waiting jobs', async () => {
      mockAiQueueService.assertQueuesEmpty.mockRejectedValueOnce(
        new Error('Conflict')
      );
      await expect(service.unloadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
    });

    it('ควรอนุญาต unload เมื่อทั้งสอง queue ว่าง', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      await service.unloadModelVram('np-dms-ai:latest');
      expect(mockOllamaService.unloadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest'
      );
    });
  });

  // ─── ADR-048 FR-008: Auto-Eviction Before Load ─────────────────────────────

  describe('FR-008: loadModelVram auto-eviction', () => {
    it('ควร auto-evict inactive model เมื่อ VRAM ไม่พอ ก่อนโหลดโมเดลใหม่', async () => {
      // VRAM: 8192MB total, 6GB used by np-dms-ocr, need 4GB for np-dms-ai
      // ต้อง evict np-dms-ocr ก่อนโหลด np-dms-ai
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      // getVramHeadroom calls axios.get — 6GB used, 2GB free (< 4GB required)
      // autoEvictIfNeeded calls axios.get again for model list
      mockedAxios.get
        .mockResolvedValueOnce({
          // getVramHeadroom: 6GB used by ocr
          data: {
            models: [
              {
                name: 'np-dms-ocr:latest',
                size_vram: 6 * 1024 * 1024 * 1024,
              },
            ],
          },
        })
        .mockResolvedValueOnce({
          // autoEvictIfNeeded: query models for eviction
          data: {
            models: [
              {
                name: 'np-dms-ocr:latest',
                size_vram: 6 * 1024 * 1024 * 1024,
              },
            ],
          },
        });

      await service.loadModelVram('np-dms-ai:latest');

      // ต้อง unload inactive model (np-dms-ocr) ก่อน load
      expect(mockOllamaService.unloadModel).toHaveBeenCalledWith(
        'np-dms-ocr:latest'
      );
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest',
        120
      );
    });

    it('ควร load ตรงเมื่อ VRAM พอ (ไม่ต้อง evict)', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      // 2GB used, 6GB free — enough for 4GB required
      mockedAxios.get.mockResolvedValue({
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
              size_vram: 2 * 1024 * 1024 * 1024,
            },
          ],
        },
      });

      await service.loadModelVram('np-dms-ocr:latest');

      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ocr:latest',
        120
      );
    });

    it('ควร load ตรงเมื่อไม่มีโมเดลโหลดอยู่เลย', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValue({
        data: { models: [] },
      });

      await service.loadModelVram('np-dms-ai:latest');

      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest',
        120
      );
    });

    // Regression (8bb5683b): เดิมเทียบชื่อโมเดลแบบ substring (includes) ทำให้
    // np-dms-ai-30b ถูกมองว่าเป็นตัวเดียวกับ np-dms-ai แล้วไม่ถูก evict → VRAM ไม่พอ
    it('ควร evict np-dms-ai-30b เมื่อจะโหลด np-dms-ai (ชื่อซ้อนกันแต่คนละโมเดล)', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      const loaded = {
        data: {
          models: [
            {
              name: 'np-dms-ai-30b:latest',
              size_vram: 6 * 1024 * 1024 * 1024,
            },
          ],
        },
      };
      mockedAxios.get
        .mockResolvedValueOnce(loaded)
        .mockResolvedValueOnce(loaded);

      await service.loadModelVram('np-dms-ai:latest');

      expect(mockOllamaService.unloadModel).toHaveBeenCalledWith(
        'np-dms-ai-30b:latest'
      );
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest',
        120
      );
    });

    it('ไม่ควร evict โมเดลเป้าหมายเอง แม้ระบุ tag :latest ต่างกัน', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      const loaded = {
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
              size_vram: 6 * 1024 * 1024 * 1024,
            },
          ],
        },
      };
      mockedAxios.get
        .mockResolvedValueOnce(loaded)
        .mockResolvedValueOnce(loaded);

      await service.loadModelVram('np-dms-ai');

      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
    });
  });

  // ─── ADR-048 FR-009: Transition Lock Conflict ──────────────────────────────

  describe('FR-009: loadModelVram transition lock conflict', () => {
    it('ควร throw 409 Conflict เมื่อ lock ถูก held โดย transition อื่น (redis.set คืน null)', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });
      mockRedis.set.mockResolvedValueOnce(null); // lock not acquired

      await expect(service.loadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.loadModel).not.toHaveBeenCalled();
    });
  });

  describe('FR-009: unloadModelVram transition lock conflict', () => {
    it('ควร throw 409 Conflict เมื่อ lock ถูก held โดย transition อื่น', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockRedis.set.mockResolvedValueOnce(null); // lock not acquired

      await expect(service.unloadModelVram('np-dms-ai:latest')).rejects.toThrow(
        'Conflict'
      );
      expect(mockOllamaService.unloadModel).not.toHaveBeenCalled();
    });
  });

  // ─── Auto-Evict error handling ─────────────────────────────────────────────

  describe('autoEvictIfNeeded error handling', () => {
    it('ควรไม่ throw เมื่อ autoEvictIfNeeded query ล้มเหลว', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      // getVramHeadroom: 6GB used, 2GB free → ต้อง evict
      // autoEvictIfNeeded: axios.get ล้มเหลว
      mockedAxios.get
        .mockResolvedValueOnce({
          data: {
            models: [
              {
                name: 'np-dms-ocr:latest',
                size_vram: 6 * 1024 * 1024 * 1024,
              },
            ],
          },
        })
        .mockRejectedValueOnce(new Error('query failed'));

      await service.loadModelVram('np-dms-ai:latest');

      // ยังโหลดได้แม้ eviction query ล้มเหลว
      expect(mockOllamaService.loadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest',
        120
      );
    });
  });

  // ─── releaseTransitionLock ─────────────────────────────────────────────────

  describe('releaseTransitionLock', () => {
    it('ควรไม่ del lock เมื่อ token ไม่ตรงกัน', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });
      // redis.set สำเร็จ แต่ redis.get คืน token อื่น (เกิดจาก transition ใหม่)
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.get.mockResolvedValueOnce('different-token');

      await service.loadModelVram('np-dms-ai:latest');

      // del ไม่ควรถูกเรียกเพราะ token ไม่ตรง
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('ควรไม่ throw เมื่อ releaseTransitionLock redis.get ล้มเหลว', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.get.mockRejectedValueOnce(new Error('Redis down'));

      await service.loadModelVram('np-dms-ai:latest');

      // ไม่ throw แม้ releaseTransitionLock ล้มเหลว
      expect(mockOllamaService.loadModel).toHaveBeenCalled();
    });

    it('ควร del lock เมื่อ token ตรงกัน (releaseTransitionLock success)', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockedAxios.get.mockResolvedValue({ data: { models: [] } });
      // Capture token จาก redis.set แล้วคืนค่าใน redis.get
      let capturedToken: string | null = null;
      mockRedis.set.mockImplementationOnce((key: string, value: string) => {
        if (key === 'ai:model:transitioning') {
          capturedToken = value;
        }
        return Promise.resolve('OK');
      });
      mockRedis.get.mockImplementationOnce(() =>
        Promise.resolve(capturedToken)
      );

      await service.loadModelVram('np-dms-ai:latest');

      expect(mockRedis.del).toHaveBeenCalledWith('ai:model:transitioning');
    });
  });

  // ─── unloadModelVram with auto-evict skip ──────────────────────────────────

  describe('unloadModelVram VRAM query failed', () => {
    it('ควร skip auto-eviction เมื่อ query ล้มเหลว', async () => {
      mockAiQueueService.assertQueuesEmpty.mockResolvedValueOnce(undefined);
      mockRedis.set.mockResolvedValueOnce('OK');
      mockRedis.get.mockResolvedValueOnce(null);

      await service.unloadModelVram('np-dms-ai:latest');

      expect(mockOllamaService.unloadModel).toHaveBeenCalledWith(
        'np-dms-ai:latest'
      );
    });
  });
});
