// File: backend/tests/integration/ai/sandbox-workflow.spec.ts
// Change Log:
// - 2026-06-15: Created integration test for 3-step sandbox workflow (T032)

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { AiBatchProcessor } from '../../../src/modules/ai/processors/ai-batch.processor';
import { AiPromptsService } from '../../../src/modules/ai/prompts/ai-prompts.service';
import { AiPolicyService } from '../../../src/modules/ai/services/ai-policy.service';
import { OcrService } from '../../../src/modules/ai/services/ocr.service';
import { OllamaService } from '../../../src/modules/ai/services/ollama.service';
import { SandboxOcrEngineService } from '../../../src/modules/ai/services/sandbox-ocr-engine.service';
import { EmbeddingService } from '../../../src/modules/ai/services/embedding.service';
import { AiRagService } from '../../../src/modules/ai/ai-rag.service';
import { Attachment } from '../../../src/common/file-storage/entities/attachment.entity';
import { Project } from '../../../src/modules/project/entities/project.entity';
import { AiPrompt } from '../../../src/modules/ai/prompts/ai-prompts.entity';
import { DataSource } from 'typeorm';
import IORedis from 'ioredis';

describe('3-Step Sandbox Workflow Integration Tests (T032)', () => {
  let _processor: AiBatchProcessor;
  let aiBatchQueue: Queue;
  let aiPromptsService: AiPromptsService;
  let dataSource: DataSource;
  let redis: IORedis;

  beforeAll(async () => {
    redis = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT || '6379'),
    });

    aiBatchQueue = new Queue('ai-batch', {
      connection: redis,
    });

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mariadb',
          host: process.env.DB_HOST || 'localhost',
          port: Number(process.env.DB_PORT || '3306'),
          username: process.env.DB_USER || 'root',
          password: process.env.DB_PASSWORD || '',
          database: process.env.DB_NAME || 'lcbp3_test',
          entities: [Attachment, Project, AiPrompt],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([Attachment, Project, AiPrompt]),
      ],
      providers: [
        AiBatchProcessor,
        AiPromptsService,
        AiPolicyService,
        OcrService,
        OllamaService,
        SandboxOcrEngineService,
        EmbeddingService,
        AiRagService,
      ],
    }).compile();

    processor = module.get<AiBatchProcessor>(AiBatchProcessor);
    aiPromptsService = module.get<AiPromptsService>(AiPromptsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await aiBatchQueue.close();
    await redis.quit();
    await dataSource.destroy();
  });

  describe('Step 1: OCR Extraction', () => {
    it('ควรส่งงาน sandbox-ocr และรับผลลัพธ์ OCR text จาก Redis', async () => {
      const idempotencyKey = 'test-sandbox-ocr-001';
      await aiBatchQueue.add('sandbox-ocr', {
        jobType: 'sandbox-ocr',
        documentPublicId: 'test-doc-001',
        projectPublicId: 'default',
        payload: {
          pdfPath: '/test/sample.pdf',
          engine: 'auto',
        },
        idempotencyKey,
      });

      // Poll Redis for result
      let result = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:ocr:result:${idempotencyKey}`);
        if (cached) {
          result = JSON.parse(cached);
          break;
        }
      }

      expect(result).toBeDefined();
      expect((result as { status: string }).status).toBe('completed');
      expect((result as { ocrText: string }).ocrText).toBeDefined();
      expect(typeof (result as { ocrText: string }).ocrText).toBe('string');
    }, 60000);
  });

  describe('Step 2: AI Metadata Extraction', () => {
    it('ควรส่งงาน sandbox-ai-extract และรับผลลัพธ์ JSON metadata จาก Redis', async () => {
      // สร้าง active prompt สำหรับ ocr_extraction
      const prompt = await aiPromptsService.create(
        'ocr_extraction',
        { template: 'Extract metadata from {{ocr_text}}' },
        1
      );
      await aiPromptsService.activate(
        'ocr_extraction',
        prompt.versionNumber,
        1
      );

      const idempotencyKey = 'test-sandbox-extract-001';
      await aiBatchQueue.add('sandbox-ai-extract', {
        jobType: 'sandbox-ai-extract',
        documentPublicId: 'test-doc-002',
        projectPublicId: 'default',
        payload: {
          promptVersion: prompt.versionNumber,
          projectPublicId: 'default',
        },
        idempotencyKey,
      });

      // Poll Redis for result
      let result = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:rag:result:${idempotencyKey}`);
        if (cached) {
          result = JSON.parse(cached);
          break;
        }
      }

      expect(result).toBeDefined();
      expect((result as { status: string }).status).toBe('completed');
      expect((result as { answer: unknown }).answer).toBeDefined();

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete('ocr_extraction', prompt.versionNumber, 1);
    }, 60000);
  });

  describe('Step 3: RAG Prep', () => {
    it('ควรส่งงาน sandbox-rag-prep และรับผลลัพธ์ chunks และ vectors จาก Redis', async () => {
      // สร้าง active prompt สำหรับ rag_prep_prompt
      const prompt = await aiPromptsService.create(
        'rag_prep_prompt',

        { template: 'Chunk this text: {{text}}' },
        1
      );
      await aiPromptsService.activate(
        'rag_prep_prompt',
        prompt.versionNumber,
        1
      );

      const idempotencyKey = 'test-sandbox-rag-prep-001';
      await aiBatchQueue.add('sandbox-rag-prep', {
        jobType: 'sandbox-rag-prep',
        documentPublicId: 'test-doc-003',
        projectPublicId: 'default',
        payload: {
          text: 'This is a test document for RAG preparation. It contains multiple sections that should be chunked semantically.',
          profileId: 'standard',
        },
        idempotencyKey,
      });

      // Poll Redis for result
      let result = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:rag:result:${idempotencyKey}`);
        if (cached) {
          result = JSON.parse(cached);
          break;
        }
      }

      expect(result).toBeDefined();
      expect((result as { status: string }).status).toBe('completed');
      expect((result as { ragChunks: unknown[] }).ragChunks).toBeDefined();
      expect(
        Array.isArray((result as { ragChunks: unknown[] }).ragChunks)
      ).toBe(true);
      expect(
        (result as { ragChunks: unknown[] }).ragChunks.length
      ).toBeGreaterThan(0);
      expect((result as { ragVectors: unknown[] }).ragVectors).toBeDefined();
      expect(
        Array.isArray((result as { ragVectors: unknown[] }).ragVectors)
      ).toBe(true);

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete('rag_prep_prompt', prompt.versionNumber, 1);
    }, 60000);
  });

  describe('Full 3-Step Workflow Integration', () => {
    it('ควรรัน 3 steps ต่อเนื่องกัน OCR → AI Extract → RAG Prep', async () => {
      // สร้าง prompts ที่จำเป็น
      const ocrPrompt = await aiPromptsService.create(
        'ocr_extraction',
        { template: 'Extract metadata from {{ocr_text}}' },
        1
      );

      await aiPromptsService.activate(
        'ocr_extraction',
        ocrPrompt.versionNumber,
        1
      );

      const ragPrompt = await aiPromptsService.create(
        'rag_prep_prompt',
        { template: 'Chunk this text: {{text}}' },
        1
      );
      await aiPromptsService.activate(
        'rag_prep_prompt',
        ragPrompt.versionNumber,
        1
      );

      const workflowId = 'test-full-workflow-001';

      // Step 1: OCR
      await aiBatchQueue.add('sandbox-ocr', {
        jobType: 'sandbox-ocr',
        documentPublicId: workflowId,
        projectPublicId: 'default',
        payload: {
          pdfPath: '/test/sample.pdf',
          engine: 'auto',
        },
        idempotencyKey: `${workflowId}-ocr`,
      });

      let ocrResult = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:ocr:result:${workflowId}-ocr`);
        if (cached) {
          ocrResult = JSON.parse(cached);
          break;
        }
      }

      expect(ocrResult).toBeDefined();
      expect((ocrResult as { status: string }).status).toBe('completed');
      const ocrText = (ocrResult as { ocrText: string }).ocrText;

      // Step 2: AI Extract
      await aiBatchQueue.add('sandbox-ai-extract', {
        jobType: 'sandbox-ai-extract',
        documentPublicId: workflowId,
        projectPublicId: 'default',
        payload: {
          promptVersion: ocrPrompt.versionNumber,
          projectPublicId: 'default',
        },
        idempotencyKey: `${workflowId}-extract`,
      });

      let extractResult = null;
      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:rag:result:${workflowId}-extract`);
        if (cached) {
          extractResult = JSON.parse(cached);
          break;
        }
      }

      expect(extractResult).toBeDefined();
      expect((extractResult as { status: string }).status).toBe('completed');
      expect((extractResult as { answer: unknown }).answer).toBeDefined();

      // Step 3: RAG Prep
      await aiBatchQueue.add('sandbox-rag-prep', {
        jobType: 'sandbox-rag-prep',
        documentPublicId: workflowId,
        projectPublicId: 'default',
        payload: {
          text: ocrText || 'Fallback text for RAG prep',
          profileId: 'standard',
        },
        idempotencyKey: `${workflowId}-rag-prep`,
      });

      let ragResult = null;

      for (let i = 0; i < 30; i++) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        const cached = await redis.get(`ai:rag:result:${workflowId}-rag-prep`);
        if (cached) {
          ragResult = JSON.parse(cached);
          break;
        }
      }

      expect(ragResult).toBeDefined();
      expect((ragResult as { status: string }).status).toBe('completed');
      expect((ragResult as { ragChunks: unknown[] }).ragChunks).toBeDefined();
      expect((ragResult as { ragVectors: unknown[] }).ragVectors).toBeDefined();

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete(
        'ocr_extraction',
        ocrPrompt.versionNumber,
        1
      );
      await aiPromptsService.delete(
        'rag_prep_prompt',
        ragPrompt.versionNumber,
        1
      );
    }, 180000);
  });
});
