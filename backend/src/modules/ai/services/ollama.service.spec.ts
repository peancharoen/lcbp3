// File: src/modules/ai/services/ollama.service.spec.ts
// Change Log:
// - 2026-06-03: สร้าง unit test สำหรับ OllamaService ครอบคลุม generate() model option,
//               getOcrModelName(), และ loadModel() keepAlive param ตาม ADR-034
// - 2026-06-13: ADR-036 — อัปเดต expected model tags เป็น np-dms-ai/np-dms-ocr
// - 2026-06-14: เพิ่ม tests สำหรับ generateEmbedding, checkHealth, unloadModel เพื่อเพิ่ม branch coverage
// - 2026-06-29: ADR-035 — อัปเดต embedModel default เป็นค่าว่าง (BGE-M3 ใน Sidecar แทน nomic-embed-text)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OllamaService } from './ollama.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaService (ADR-034)', () => {
  let service: OllamaService;
  const configValues: Record<string, unknown> = {
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_MODEL_MAIN: 'np-dms-ai:latest',
    OLLAMA_MODEL_OCR: 'np-dms-ocr:latest',
    OLLAMA_MODEL_EMBED: 'nomic-embed-text', // ยังตั้งค่าใน test เพื่อทดสอบ generateEmbedding path
    AI_TIMEOUT_MS: 30000,
    AI_BATCH_TIMEOUT_MS: 120000,
    OLLAMA_MAIN_KEEP_ALIVE_SECONDS: 120,
  };
  const mockConfigService = {
    get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return (configValues[key] as T | undefined) ?? defaultValue;
    }),
  };
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<OllamaService>(OllamaService);
    jest.clearAllMocks();
  });
  describe('getMainModelName()', () => {
    it('ควรคืน np-dms-ai:latest เป็น main model (ADR-036)', () => {
      expect(service.getMainModelName()).toBe('np-dms-ai:latest');
    });
  });
  describe('getOcrModelName()', () => {
    it('ควรคืน np-dms-ocr:latest เป็น OCR model (ADR-036)', () => {
      expect(service.getOcrModelName()).toBe('np-dms-ocr:latest');
    });
  });
  describe('generate()', () => {
    it('ควรใช้ mainModel เมื่อ options.model ไม่ได้ระบุ', async () => {
      mockedAxios.post = jest
        .fn()
        .mockResolvedValueOnce({ data: { response: 'test response' } });
      await service.generate('test prompt');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ model: 'np-dms-ai:latest' }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive เป็น duration string (เช่น "120s") เพื่อรองรับ Ollama 0.30+', async () => {
      // Regression: Ollama 0.30+ ต้องการ keep_alive เป็น duration string
      // ถ้าส่งเป็น number จะ fail ด้วย "time: missing unit in duration"
      mockedAxios.post = jest
        .fn()
        .mockResolvedValueOnce({ data: { response: 'ok' } });
      await service.generate('test prompt');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '120s' }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive เป็น duration string เมื่อ caller ระบุ keepAlive เป็น number', async () => {
      mockedAxios.post = jest
        .fn()
        .mockResolvedValueOnce({ data: { response: 'ok' } });
      await service.generate('test prompt', { keepAlive: 60 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '60s' }),
        expect.anything()
      );
    });
    it('ควรส่ง format=json เมื่อ caller ต้องการ structured output', async () => {
      mockedAxios.post = jest
        .fn()
        .mockResolvedValueOnce({ data: { response: '{"ok":true}' } });
      await service.generate('json prompt', {
        format: 'json',
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ format: 'json' }),
        expect.anything()
      );
    });
    it('ควรใช้ options.model เมื่อระบุ model อื่น (ADR-034 model switching)', async () => {
      mockedAxios.post = jest
        .fn()
        .mockResolvedValueOnce({ data: { response: 'ocr result' } });
      await service.generate('ocr prompt', {
        model: 'np-dms-ocr:latest',
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ model: 'np-dms-ocr:latest' }),
        expect.anything()
      );
    });
  });
  describe('loadModel()', () => {
    it('ควรส่ง finite keep_alive เป็น duration string จาก config เมื่อไม่ระบุ keepAlive', async () => {
      // Ollama 0.30+ ต้องการ keep_alive เป็น duration string (เช่น "120s")
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
              model: 'np-dms-ai:latest',
            },
          ],
        },
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      await service.loadModel('np-dms-ai:latest');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '120s' }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive: "0s" เมื่อ keepAlive=0 (OCR model switching, ADR-034)', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          models: [
            {
              name: 'np-dms-ocr:latest',
              model: 'np-dms-ocr:latest',
            },
          ],
        },
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      await service.loadModel('np-dms-ocr:latest', 0);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '0s' }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive เป็น duration string เมื่อ caller ระบุ keepAlive เป็น number', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
              model: 'np-dms-ai:latest',
            },
          ],
        },
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      await service.loadModel('np-dms-ai:latest', 60);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '60s' }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive เป็น string ตรงๆ เมื่อ caller ระบุ keepAlive เป็น string', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          models: [
            {
              name: 'np-dms-ai:latest',
              model: 'np-dms-ai:latest',
            },
          ],
        },
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      await service.loadModel('np-dms-ai:latest', '30m');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ keep_alive: '30m' }),
        expect.anything()
      );
    });
    it('ควรคืน false เมื่อ model ไม่ได้ติดตั้งใน Ollama', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: { models: [{ name: 'other-model', model: 'other-model' }] },
      });
      const result = await service.loadModel('np-dms-ocr:latest', 0);
      expect(result).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });
    it('ควรคืน false และ log error เมื่อ axios throw ระหว่าง loadModel', async () => {
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await service.loadModel('np-dms-ai:latest');
      expect(result).toBe(false);
    });
  });
  describe('getEmbeddingModelName()', () => {
    it('ควรคืนค่า ENV ที่กำหนด เป็น embedding model', () => {
      expect(service.getEmbeddingModelName()).toBe('nomic-embed-text');
    });
  });
  describe('getBatchTimeoutMs()', () => {
    it('ควรคืนค่า AI_BATCH_TIMEOUT_MS จาก ENV (default 120000ms สำหรับ BullMQ ai-batch)', () => {
      expect(service.getBatchTimeoutMs()).toBe(120000);
    });
  });
  describe('generateEmbedding()', () => {
    it('ควรคืน embedding vector เมื่อ Ollama ตอบกลับสำเร็จ', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { embedding: mockVector },
      });
      const result = await service.generateEmbedding('test text');
      expect(result).toEqual(mockVector);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/embeddings'),
        expect.objectContaining({
          model: 'nomic-embed-text',
          prompt: 'test text',
        }),
        expect.anything()
      );
    });
    it('ควร throw error เมื่อ Ollama embedding ล้มเหลว', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce(new Error('Embedding failed'));
      await expect(service.generateEmbedding('test')).rejects.toThrow(
        'Embedding failed'
      );
    });
  });
  describe('checkHealth()', () => {
    it('ควรคืน HEALTHY พร้อมโมเดลที่โหลดอยู่และ version จาก /api/version', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} }) // /api/tags
        .mockResolvedValueOnce({
          data: { models: [{ name: 'np-dms-ai:latest' }] },
        }) // /api/ps
        .mockResolvedValueOnce({ data: { version: '0.30.10' } }); // /api/version
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.models).toContain('np-dms-ai:latest');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.version).toBe('0.30.10');
    });
    it('ควรคืน HEALTHY พร้อม fallback models เมื่อ /api/ps ไม่มีข้อมูล', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} }) // /api/tags OK
        .mockResolvedValueOnce({ data: { models: [] } }) // /api/ps empty
        .mockResolvedValueOnce({ data: { version: '0.30.10' } }); // /api/version
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.models).toContain('np-dms-ai:latest'); // fallback
      expect(result.version).toBe('0.30.10');
    });
    it('ควรคืน HEALTHY แม้ /api/ps throw error (graceful degradation)', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} }) // /api/tags OK
        .mockRejectedValueOnce(new Error('ps endpoint error')) // /api/ps fails
        .mockResolvedValueOnce({ data: { version: '0.30.10' } }); // /api/version
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.version).toBe('0.30.10');
    });
    it('ควรคืน HEALTHY แม้ /api/version throw error (version undefined)', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} }) // /api/tags OK
        .mockResolvedValueOnce({ data: { models: [] } }) // /api/ps empty
        .mockRejectedValueOnce(new Error('version endpoint error')); // /api/version fails
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.version).toBeUndefined();
    });
    it('ควรคืน DEGRADED เมื่อ /api/tags timeout', async () => {
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('timeout error'));
      const result = await service.checkHealth();
      expect(result.status).toBe('DEGRADED');
      expect(result.error).toContain('timeout');
    });
    it('ควรคืน DEGRADED เมื่อ error message มี code ECONNABORTED', async () => {
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('code ECONNABORTED'));
      const result = await service.checkHealth();
      expect(result.status).toBe('DEGRADED');
    });
    it('ควรคืน DOWN เมื่อ connection ถูกปฏิเสธ (ไม่ใช่ timeout)', async () => {
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await service.checkHealth();
      expect(result.status).toBe('DOWN');
    });
  });
  describe('unloadModel()', () => {
    it('ควรคืน true เมื่อ unload สำเร็จ', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      const result = await service.unloadModel('np-dms-ocr:latest');
      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/generate'),
        expect.objectContaining({ model: 'np-dms-ocr:latest', keep_alive: 0 }),
        expect.anything()
      );
    });
    it('ควรคืน false เมื่อ unload ล้มเหลว', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce(new Error('Unload failed'));
      const result = await service.unloadModel('np-dms-ocr:latest');
      expect(result).toBe(false);
    });
  });
  describe('generate() error path', () => {
    it('ควร throw error เมื่อ Ollama generate ล้มเหลว', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce(new Error('LLM timeout'));
      await expect(service.generate('test prompt')).rejects.toThrow(
        'LLM timeout'
      );
    });

    it('ควร throw error เมื่อ Ollama generate ล้มเหลวด้วย non-Error', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce('string error' as unknown as Error);
      await expect(service.generate('test prompt')).rejects.toBe(
        'string error'
      );
    });

    it('ควรคืน empty string เมื่อ response.data.response เป็น undefined', async () => {
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      const result = await service.generate('test prompt');
      expect(result).toBe('');
    });
  });

  describe('generateEmbedding() non-Error path', () => {
    it('ควร throw เมื่อ embedding ล้มเหลวด้วย non-Error', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce('network error' as unknown as Error);
      await expect(service.generateEmbedding('test')).rejects.toBe(
        'network error'
      );
    });
  });

  describe('constructor fallbacks', () => {
    it('ควรใช้ AI_HOST_URL เป็น fallback เมื่อ OLLAMA_URL ไม่ได้ตั้งค่า', async () => {
      const fallbackConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            AI_HOST_URL: 'http://192.168.10.11:11434',
            OLLAMA_MODEL_MAIN: 'np-dms-ai:latest',
            OLLAMA_MODEL_OCR: 'np-dms-ocr:latest',
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          OllamaService,
          { provide: ConfigService, useValue: fallbackConfig },
        ],
      }).compile();
      const svc = mod.get<OllamaService>(OllamaService);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: {} });
      await svc.checkHealth();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://192.168.10.11:11434/api/tags',
        expect.anything()
      );
    });

    it('ควรใช้ default URL เมื่อไม่ได้ตั้งค่า OLLAMA_URL และ AI_HOST_URL', async () => {
      const emptyConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          return defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          OllamaService,
          { provide: ConfigService, useValue: emptyConfig },
        ],
      }).compile();
      const svc = mod.get<OllamaService>(OllamaService);
      mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: {} });
      await svc.checkHealth();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://192.168.10.11:11434/api/tags',
        expect.anything()
      );
    });
  });

  describe('checkHealth() โดยไม่มี embed model', () => {
    it('ควรคืน models เฉพาะ main model เมื่อ embedModel ว่าง', async () => {
      const noEmbedConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            OLLAMA_URL: 'http://localhost:11434',
            OLLAMA_MODEL_MAIN: 'np-dms-ai:latest',
            OLLAMA_MODEL_OCR: 'np-dms-ocr:latest',
            OLLAMA_MODEL_EMBED: '',
            AI_TIMEOUT_MS: 30000,
            AI_BATCH_TIMEOUT_MS: 120000,
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          OllamaService,
          { provide: ConfigService, useValue: noEmbedConfig },
        ],
      }).compile();
      const svc = mod.get<OllamaService>(OllamaService);
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: { models: [] } })
        .mockResolvedValueOnce({ data: { version: '0.30.10' } });
      const result = await svc.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.models).toEqual(['np-dms-ai:latest']);
    });

    it('ควรคืน models เฉพาะ main model เมื่อ /api/tags ล้มเหลวและไม่มี embedModel', async () => {
      const noEmbedConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            OLLAMA_URL: 'http://localhost:11434',
            OLLAMA_MODEL_MAIN: 'np-dms-ai:latest',
            OLLAMA_MODEL_OCR: 'np-dms-ocr:latest',
            OLLAMA_MODEL_EMBED: '',
            AI_TIMEOUT_MS: 30000,
            AI_BATCH_TIMEOUT_MS: 120000,
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          OllamaService,
          { provide: ConfigService, useValue: noEmbedConfig },
        ],
      }).compile();
      const svc = mod.get<OllamaService>(OllamaService);
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'));
      const result = await svc.checkHealth();
      expect(result.status).toBe('DOWN');
      expect(result.models).toEqual(['np-dms-ai:latest']);
    });

    it('ควรจัดการ non-Error ใน /api/ps error', async () => {
      mockedAxios.get = jest
        .fn()
        .mockResolvedValueOnce({ data: {} })
        .mockRejectedValueOnce('string error' as unknown as Error)
        .mockResolvedValueOnce({ data: { version: '0.30.10' } });
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
    });
  });

  describe('loadModel() edge cases', () => {
    it('ควรคืน false เมื่อ tagsResponse.data เป็น null', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({ data: null });
      const result = await service.loadModel('np-dms-ai:latest');
      expect(result).toBe(false);
    });

    it('ควรคืน false เมื่อ non-Error ถูก throw ใน loadModel', async () => {
      mockedAxios.get = jest
        .fn()
        .mockRejectedValueOnce('network error' as unknown as Error);
      const result = await service.loadModel('np-dms-ai:latest');
      expect(result).toBe(false);
    });

    it('ควรตรวจพบ model โดยใช้ startsWith match', async () => {
      mockedAxios.get = jest.fn().mockResolvedValueOnce({
        data: {
          models: [{ name: 'np-dms-ai:latest', model: 'other' }],
        },
      });
      mockedAxios.post = jest.fn().mockResolvedValueOnce({ data: {} });
      const result = await service.loadModel('np-dms-ai');
      expect(result).toBe(true);
    });
  });

  describe('unloadModel() non-Error path', () => {
    it('ควรคืน false เมื่อ non-Error ถูก throw ใน unloadModel', async () => {
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce('connection error' as unknown as Error);
      const result = await service.unloadModel('np-dms-ocr:latest');
      expect(result).toBe(false);
    });
  });
});
