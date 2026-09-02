// File: backend/tests/contract/ollama.contract.spec.ts
// Change Log:
// - 2026-09-02: สร้าง contract test สำหรับ smoke test กับ Ollama จริง (ADR-040 D3)
//   ตรวจจับ breaking changes ของ Ollama API (เช่น keep_alive format ใน 0.30+)
//   Gate ด้วย env OLLAMA_CONTRACT_TEST=true — skip เมื่อไม่ได้เปิดใช้งาน

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { OllamaService } from '../../src/modules/ai/services/ollama.service';

/**
 * Contract Test สำหรับ Ollama API — ส่ง request จริงไป Ollama แล้วตรวจ response
 *
 * วัตถุประสงค์: ตรวจจับ breaking changes ของ Ollama API ที่อาจทำให้ payload
 * format ที่ใช้ใน OllamaService ไม่ทำงาน (เช่น keep_alive ที่เปลี่ยนจาก number
 * เป็น duration string ใน Ollama 0.30+)
 *
 * วิธีรัน: OLLAMA_CONTRACT_TEST=true OLLAMA_URL=http://192.168.10.11:11434 npx jest --testPathPatterns="ollama.contract"
 *
 * ใน CI ปกติ (ไม่มี Ollama) test จะถูก skip อัตโนมัติ
 */
const shouldRun = process.env['OLLAMA_CONTRACT_TEST'] === 'true';
const describeOrSkip = shouldRun ? describe : describe.skip;

describeOrSkip('OllamaService Contract Test (real Ollama)', () => {
  let service: OllamaService;
  const ollamaUrl = process.env['OLLAMA_URL'] ?? 'http://192.168.10.11:11434';
  const mainModel = process.env['OLLAMA_MODEL_MAIN'] ?? 'np-dms-ai:latest';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OllamaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
              const config: Record<string, unknown> = {
                OLLAMA_URL: ollamaUrl,
                OLLAMA_MODEL_MAIN: mainModel,
                OLLAMA_MODEL_OCR: 'np-dms-ocr:latest',
                OLLAMA_MODEL_EMBED: '',
                AI_TIMEOUT_MS: 30000,
                AI_BATCH_TIMEOUT_MS: 120000,
                OLLAMA_MAIN_KEEP_ALIVE_SECONDS: 120,
              };
              return (config[key] as T | undefined) ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();
    service = module.get<OllamaService>(OllamaService);
  });

  describe('checkHealth() — version detection', () => {
    it('ควรดึง Ollama version จาก /api/version สำเร็จ', async () => {
      const result = await service.checkHealth();
      expect(result.status).toBe('HEALTHY');
      expect(result.version).toBeDefined();
      expect(result.version).toMatch(/^\d+\.\d+/);
    });
  });

  describe('generate() — keep_alive duration string format', () => {
    it('ควรส่ง keep_alive เป็น duration string และได้ response สำเร็จ (ไม่ 400)', async () => {
      const response = await service.generate('Say hello in one word.', {
        timeoutMs: 30000,
      });
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });

    it('ควรส่ง keep_alive เป็น duration string เมื่อ caller ระบุ keepAlive เป็น number', async () => {
      const response = await service.generate('Say hi.', {
        timeoutMs: 30000,
        keepAlive: 60,
      });
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    });
  });

  describe('generate() — format=json structured output', () => {
    it('ควรได้ valid JSON เมื่อ format=json', async () => {
      const response = await service.generate(
        'Return a JSON object with key "status" and value "ok".',
        { timeoutMs: 30000, format: 'json' }
      );
      expect(() => {
        JSON.parse(response);
      }).not.toThrow();
      const parsed = JSON.parse(response) as Record<string, unknown>;
      expect(parsed).toHaveProperty('status');
    });
  });

  describe('raw Ollama API — keep_alive format validation', () => {
    it('Ollama ควรปฏิเสธ keep_alive เป็น number ด้วย 400 (document breaking change)', async () => {
      // ทดสอบว่า Ollama 0.30+ ปฏิเสธ number จริง — ยืนยันว่าเราต้องส่ง duration string
      try {
        await axios.post(
          `${ollamaUrl}/api/generate`,
          {
            model: mainModel,
            prompt: 'test',
            stream: false,
            keep_alive: 120, // number — ควร fail ใน Ollama 0.30+
          },
          { timeout: 10000 }
        );
        // ถ้าไม่ fail แปลว่า Ollama version เก่ากว่า 0.30 — ยังรับ number ได้
        // (ไม่ใช่ error แต่บ่งชี้ว่า version detection สำคัญ)
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { status?: number; data?: { error?: string } };
        };
        expect(axiosErr.response?.status).toBe(400);
        expect(axiosErr.response?.data?.error).toContain('missing unit');
      }
    });

    it('Ollama ควรรับ keep_alive เป็น duration string สำเร็จ (200)', async () => {
      const response = await axios.post(
        `${ollamaUrl}/api/generate`,
        {
          model: mainModel,
          prompt: 'test',
          stream: false,
          keep_alive: '120s',
        },
        { timeout: 30000 }
      );
      expect(response.status).toBe(200);
    });
  });
});
