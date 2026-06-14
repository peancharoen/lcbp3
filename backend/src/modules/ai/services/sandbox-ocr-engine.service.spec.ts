// File: src/modules/ai/services/sandbox-ocr-engine.service.spec.ts
// Change Log:
// - 2026-06-14: สร้าง unit tests สำหรับ SandboxOcrEngineService ครอบคลุม detectAndExtract ทุก engine

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { SandboxOcrEngineService } from './sandbox-ocr-engine.service';
import { OcrService } from './ocr.service';

jest.mock('axios');
jest.mock('fs');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedFs = fs as jest.Mocked<typeof fs>;

/** OcrService mock สำหรับ tesseract/fast-path */
const mockOcrService = {
  detectAndExtract: jest.fn(),
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
      expect(result.engineUsed).toBe('tesseract');
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

  describe('detectAndExtract() — engine=tesseract', () => {
    it('ควร route ไปยัง OcrService เมื่อ engine=tesseract', async () => {
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'tesseract text',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/file.pdf',
        'tesseract'
      );
      expect(result.engineUsed).toBe('tesseract');
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('detectAndExtract() — engine=typhoon-np-dms-ocr (legacy alias)', () => {
    it('ควรแปลง typhoon-np-dms-ocr เป็น np-dms-ocr และส่งไปยัง sidecar', async () => {
      const mockBuffer = Buffer.from('pdf content');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          text: 'ocr text via alias',
          ocrUsed: true,
          engineUsed: 'np-dms-ocr',
        },
      });
      const result = await service.detectAndExtract(
        '/tmp/file.pdf',
        'typhoon-np-dms-ocr'
      );
      expect(result.text).toBe('ocr text via alias');
      expect(result.engineUsed).toBe('np-dms-ocr');
      expect(result.fallbackUsed).toBe(false);
    });
  });

  describe('detectAndExtract() — engine=np-dms-ocr (sidecar path)', () => {
    it('ควรส่ง file ไปยัง sidecar /ocr-upload สำเร็จ', async () => {
      const mockBuffer = Buffer.from('pdf binary data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockResolvedValueOnce({
        data: {
          text: 'extracted from typhoon',
          ocrUsed: true,
          engineUsed: 'np-dms-ocr',
        },
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.text).toBe('extracted from typhoon');
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

    it('ควรส่ง typhoonOptions (temperature, topP, repeatPenalty) ไปใน form data', async () => {
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

    it('ควร fallback ไปยัง Tesseract เมื่อ fs.readFileSync ล้มเหลว (outer catch fallback)', async () => {
      (mockedFs.readFileSync as jest.Mock).mockImplementationOnce(() => {
        throw new Error('ENOENT: file not found');
      });
      // service จะ catch error และ fallback ไปยัง Tesseract
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'tesseract fallback text',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/missing.pdf',
        'np-dms-ocr'
      );
      expect(result.fallbackUsed).toBe(true);
      expect(result.engineUsed).toBe('tesseract');
    });

    it('ควร fallback ไปยัง Tesseract เมื่อ sidecar HTTP error เกิดขึ้น', async () => {
      const mockBuffer = Buffer.from('pdf data');
      (mockedFs.readFileSync as jest.Mock).mockReturnValueOnce(mockBuffer);
      mockedAxios.post = jest.fn().mockRejectedValueOnce(
        Object.assign(new Error('Request failed'), {
          response: { status: 500, data: { detail: 'Internal Server Error' } },
        })
      );
      mockOcrService.detectAndExtract.mockResolvedValueOnce({
        text: 'tesseract fallback result',
        ocrUsed: true,
      });
      const result = await service.detectAndExtract(
        '/tmp/doc.pdf',
        'np-dms-ocr'
      );
      expect(result.text).toBe('tesseract fallback result');
      expect(result.fallbackUsed).toBe(true);
      expect(result.engineUsed).toBe('tesseract');
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
