// File: src/modules/ai/services/ollama.service.spec.ts
// Change Log:
// - 2026-06-03: สร้าง unit test สำหรับ OllamaService ครอบคลุม generate() model option,
//               getOcrModelName(), และ loadModel() keepAlive param ตาม ADR-034
// - 2026-06-13: ADR-036 — อัปเดต expected model tags เป็น np-dms-ai/np-dms-ocr

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
    OLLAMA_MODEL_EMBED: 'nomic-embed-text',
    AI_TIMEOUT_MS: 30000,
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
    it('ควรส่ง keep_alive: -1 เป็น default เมื่อไม่ระบุ keepAlive', async () => {
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
        expect.objectContaining({ keep_alive: -1 }),
        expect.anything()
      );
    });
    it('ควรส่ง keep_alive: 0 เมื่อ keepAlive=0 (OCR model switching, ADR-034)', async () => {
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
        expect.objectContaining({ keep_alive: 0 }),
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
  });
});
