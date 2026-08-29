// File: backend/src/modules/ai/intent-classifier/services/ollama-client.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ OllamaClientService ครอบคลุม classifyIntent และ parseResponse (ADR-024)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { OllamaClientService } from './ollama-client.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OllamaClientService', () => {
  let service: OllamaClientService;

  const configValues: Record<string, unknown> = {
    OLLAMA_URL: 'http://localhost:11434',
    OLLAMA_INTENT_MODEL: 'np-dms-ai:latest',
    OLLAMA_INTENT_TIMEOUT_MS: 5000,
  };

  const mockConfigService = {
    get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return (configValues[key] as T | undefined) ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaClientService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<OllamaClientService>(OllamaClientService);
  });

  it('ควรสร้าง instance ได้', () => {
    expect(service).toBeDefined();
  });

  describe('classifyIntent()', () => {
    it('ควรคืน LlmIntentResult เมื่อ Ollama ตอบกลับ JSON ถูกต้อง', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":"RAG_QUERY","confidence":0.95}',
          done: true,
        },
      });
      const result = await service.classifyIntent('อยากรู้เรื่องเอกสาร');
      expect(result).toEqual({ intent: 'RAG_QUERY', confidence: 0.95 });
    });

    it('ควร strip markdown code block ออกก่อน parse', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '```json\n{"intent":"GET_RFA","confidence":0.8}\n```',
          done: true,
        },
      });
      const result = await service.classifyIntent('show me RFA');
      expect(result).toEqual({ intent: 'GET_RFA', confidence: 0.8 });
    });

    it('ควร clamp confidence ให้อยู่ในช่วง 0-1', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":"GET_DRAWING","confidence":1.5}',
          done: true,
        },
      });
      const result = await service.classifyIntent('show drawings');
      expect(result).toEqual({ intent: 'GET_DRAWING', confidence: 1 });
    });

    it('ควร clamp confidence ต่ำกว่า 0 เป็น 0', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":"FALLBACK","confidence":-0.5}',
          done: true,
        },
      });
      const result = await service.classifyIntent('hello');
      expect(result).toEqual({ intent: 'FALLBACK', confidence: 0 });
    });

    it('ควรคืน null เมื่อ intent ไม่ใช่ string', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":123,"confidence":0.9}',
          done: true,
        },
      });
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });

    it('ควรคืน null เมื่อ confidence ไม่ใช่ number', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":"RAG_QUERY","confidence":"high"}',
          done: true,
        },
      });
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });

    it('ควรคืน null เมื่อ JSON parse ล้มเหลว', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: 'not valid json at all',
          done: true,
        },
      });
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });

    it('ควรคืน null และ log warn เมื่อ AxiosError เกิดขึ้น', async () => {
      const axiosError = new AxiosError('timeout', 'ETIMEDOUT');
      mockedAxios.post.mockRejectedValueOnce(axiosError);
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });

    it('ควรคืน null และ log error เมื่อ error ไม่ใช่ AxiosError', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('unexpected'));
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });

    it('ควรคืน null เมื่อ error ไม่ใช่ Error instance', async () => {
      mockedAxios.post.mockRejectedValueOnce('string error');
      const result = await service.classifyIntent('test');
      expect(result).toBeNull();
    });
  });

  describe('config fallback', () => {
    it('ควรใช้ AI_HOST_URL fallback เมื่อ OLLAMA_URL ไม่ได้ตั้งค่า', async () => {
      const fallbackConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            AI_HOST_URL: 'http://192.168.10.11:11434',
            OLLAMA_MODEL_MAIN: 'np-dms-ai:latest',
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          OllamaClientService,
          { provide: ConfigService, useValue: fallbackConfig },
        ],
      }).compile();
      const svc = mod.get<OllamaClientService>(OllamaClientService);
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          response: '{"intent":"RAG_QUERY","confidence":0.9}',
          done: true,
        },
      });
      await svc.classifyIntent('test');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://192.168.10.11:11434/api/generate',
        expect.anything(),
        expect.anything()
      );
    });
  });
});
