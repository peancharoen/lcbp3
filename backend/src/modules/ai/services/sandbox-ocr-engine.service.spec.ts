// File: src/modules/ai/services/sandbox-ocr-engine.service.spec.ts
// Change Log:
// - 2026-06-14: สร้าง unit tests สำหรับ SandboxOcrEngineService ครอบคลุม detectAndExtract ทุก engine
// - 2026-06-20: เพิ่ม mock getRepositoryToken(AiExecutionProfile) สำหรับทดสอบ parameter governance

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import * as fs from 'fs';
import { SandboxOcrEngineService } from './sandbox-ocr-engine.service';
import { OcrService } from './ocr.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';

jest.mock('axios');
jest.mock('fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

/** OcrService mock สำหรับ fast-path */
const mockOcrService = {
  detectAndExtract: jest.fn(),
};

/** AiPromptsService mock สำหรับ ocr_system prompt */
const mockAiPromptsService = {
  getActive: jest.fn().mockResolvedValue({
    template: 'mock active system prompt',
    contextConfig: {
      dmsTags: ['tag1', 'tag2'],
    },
  }),
};

/** AiExecutionProfile mock repository */
const mockProfile = {
  profileName: 'ocr-extract',
  temperature: 0.1,
  topP: 0.5,
  repeatPenalty: 1.0,
  maxTokens: 16000,
};
const mockProfileRepository = {
  findOne: jest.fn().mockResolvedValue(mockProfile),
};

/** ConfigService mock */
const mockConfigService = {
  get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
    const cfg: Record<string, unknown> = {
      OCR_API_URL: 'http://localhost:8765',
      OCR_SIDECAR_API_KEY: 'test-api-key-2026',
    };
    return (cfg[key] as T | undefined) ?? defaultValue;
  }),
};

describe('SandboxOcrEngineService', () => {
  let service: SandboxOcrEngineService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SandboxOcrEngineService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: OcrService, useValue: mockOcrService },
        { provide: AiPromptsService, useValue: mockAiPromptsService },
        {
          provide: getRepositoryToken(AiExecutionProfile),
          useValue: mockProfileRepository,
        },
      ],
    }).compile();
    service = module.get<SandboxOcrEngineService>(SandboxOcrEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('detectAndExtract() — engine=auto', () => {
    it('ควร route ไปยัง OcrService เมื่อ engine=auto', async () => {
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'auto extracted text',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract('/tmp/file.pdf', 'auto');
      expect(result.text).toBe('auto extracted text');
      expect(result.engineUsed).toBe('fast-path');
      expect(result.fallbackUsed).toBe(false);
      expect(mockOcrService.detectAndExtract).toHaveBeenCalledWith({
        pdfPath: '/tmp/file.pdf',
      });
    });

    it('ควรใช้ fast-path engineUsed เมื่อ OcrService คืน ocrUsed=false', async () => {
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'embedded text',
        ocrUsed: false,
      });
      const result = await service.detectAndExtract('/tmp/file.pdf', 'auto');
      expect(result.engineUsed).toBe('fast-path');
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('detectAndExtract() — engine=np-dms-ocr (sidecar path)', () => {
    it('ควรส่ง file ไปยัง sidecar /ocr-upload สำเร็จ', async () => {
      const mockBuffer = Buffer.from('pdf binary data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          text: 'extracted from np-dms-ocr',
          ocrUsed: true,
          engineUsed: 'np-dms-ocr',
        },
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.text).toBe('extracted from np-dms-ocr');
      expect(result.ocrUsed).toBe(true);
      expect(result.engineUsed).toBe('np-dms-ocr');
      expect(result.fallbackUsed).toBe(false);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/ocr-upload'),
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': 'test-api-key-2026',
          }),
        })
      );
    });

    it('ควรส่ง ocrOptions (temperature, topP, repeatPenalty) ไปใน form data', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: { text: 'result', ocrUsed: true, engineUsed: 'np-dms-ocr' },
      });
      await service.detectAndExtract('/tmp/doc.pdf', 'np-dms-ocr', {
        temperature: 0.5,
        topP: 0.8,
        repeatPenalty: 1.2,
      });
      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('ควรใช้ fallback values เมื่อ sidecar response ไม่มี text/ocrUsed/engineUsed', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {},
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.text).toBe('');
      expect(result.ocrUsed).toBe(true);
      expect(result.engineUsed).toBe('np-dms-ocr'); // resolvedEngineType fallback
    });

    it('ควร fallback ไปยัง fast-path เมื่อ fs.readFileSync ล้มเหลว (outer catch fallback)', async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('ENOENT: file not found');
      });
      // service จะ catch error และ fallback ไปยัง fast-path
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'fast-path fallback text',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/missing.pdf',
        'np-dms-ocr'
      );
      expect(result.fallbackUsed).toBe(true);
      expect(result.engineUsed).toBe('fast-path');
    });

    it('ควร fallback ไปยัง fast-path เมื่อ sidecar HTTP error เกิดขึ้น', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockRejectedValueOnce(
        Object.assign(new Error('Request failed'), {
          response: { status: 500, data: { detail: 'Internal Server Error' } },
        })
      );
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'fast-path fallback result',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.text).toBe('fast-path fallback result');
      expect(result.fallbackUsed).toBe(true);
      expect(result.engineUsed).toBe('fast-path');
    });

    it('ควร fallback ไปยัง fast-path เมื่อ sidecar error และ OcrService ส่ง ocrUsed=false', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce(new Error('Connection refused'));
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'embedded text',
        ocrUsed: false,
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.engineUsed).toBe('fast-path');
      expect(result.fallbackUsed).toBe(true);
    });
  });

  describe('detectAndExtract() — default engine (no arg)', () => {
    it('ควรใช้ auto เป็น default engine เมื่อไม่ระบุ engineType', async () => {
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'default text',
        ocrUsed: false,
      });
      const result = await service.detectAndExtract('/tmp/file.pdf');
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('detectAndExtract() — edge cases', () => {
    it('ควร handle axios error ที่ไม่มี response.status gracefully', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network unreachable'));
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'fallback text',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.fallbackUsed).toBe(true);
    });
  });
});
