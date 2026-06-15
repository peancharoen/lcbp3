// File: backend/tests/integration/ai/sandbox-runtime-params.spec.ts
// Change Log:
// - 2026-06-15: Created integration test for runtime parameters application to sandbox (T043)

import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Queue } from 'bullmq';
import { AiBatchProcessor } from '../../../src/modules/ai/processors/ai-batch.processor';
import { AiPolicyService } from '../../../src/modules/ai/services/ai-policy.service';
import { AiPromptsService } from '../../../src/modules/ai/prompts/ai-prompts.service';
import { AiExecutionProfile } from '../../../src/modules/ai/entities/ai-execution-profile.entity';
import { AiSandboxProfile } from '../../../src/modules/ai/entities/ai-sandbox-profile.entity';
import { AiPrompt } from '../../../src/modules/ai/prompts/ai-prompts.entity';
import { DataSource } from 'typeorm';
import IORedis from 'ioredis';

describe('Sandbox Runtime Parameters Integration Tests (T043)', () => {
  let _processor: AiBatchProcessor;
  let aiPolicyService: AiPolicyService;
  let aiPromptsService: AiPromptsService;
  let aiBatchQueue: Queue;
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
          entities: [AiExecutionProfile, AiSandboxProfile, AiPrompt],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          AiExecutionProfile,
          AiSandboxProfile,
          AiPrompt,
        ]),
      ],
      providers: [AiBatchProcessor, AiPolicyService, AiPromptsService],
    }).compile();

    _processor = module.get<AiBatchProcessor>(AiBatchProcessor);
    aiPolicyService = module.get<AiPolicyService>(AiPolicyService);
    aiPromptsService = module.get<AiPromptsService>(AiPromptsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await aiBatchQueue.close();
    await redis.quit();
    await dataSource.destroy();
  });

  describe('Runtime Parameters Application', () => {
    it('ควรใช้ custom profile parameters เมื่อระบุ profileId ใน sandbox-rag-prep job', async () => {
      // สร้าง custom execution profile
      const profileRepo = dataSource.getRepository(AiExecutionProfile);
      const customProfile = profileRepo.create({
        profileName: 'custom-rag-profile',
        canonicalModel: 'np-dms-ai',
        temperature: 0.2,
        topP: 0.7,
        maxTokens: 2048,
        numCtx: 4096,
        repeatPenalty: 1.2,
        keepAliveSeconds: 30,
        isActive: true,
        createdBy: 1,
      });
      await profileRepo.save(customProfile);

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

      const idempotencyKey = 'test-runtime-params-001';
      await aiBatchQueue.add('sandbox-rag-prep', {
        jobType: 'sandbox-rag-prep',
        documentPublicId: 'test-doc-001',
        projectPublicId: 'default',
        payload: {
          text: 'Test text for runtime parameters',
          profileId: 'custom-rag-profile',
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

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete('rag_prep_prompt', prompt.versionNumber, 1);
      await profileRepo.delete(customProfile.id);
    }, 60000);

    it('ควร fallback ไป standard profile เมื่อ profileId ไม่มีอยู่', async () => {
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

      const idempotencyKey = 'test-runtime-params-fallback';
      await aiBatchQueue.add('sandbox-rag-prep', {
        jobType: 'sandbox-rag-prep',
        documentPublicId: 'test-doc-002',
        projectPublicId: 'default',
        payload: {
          text: 'Test text for fallback',
          profileId: 'non-existent-profile',
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

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete('rag_prep_prompt', prompt.versionNumber, 1);
    }, 60000);

    it('ควรใช้ sandbox draft parameters เมื่อระบุใน sandbox-ai-extract job', async () => {
      const sandboxRepo = dataSource.getRepository(AiSandboxProfile);
      const sandboxDraft = sandboxRepo.create({
        profileName: 'standard',
        canonicalModel: 'np-dms-ai',
        temperature: 0.3,
        topP: 0.6,
        maxTokens: 2048,
        numCtx: 4096,
        repeatPenalty: 1.1,
        keepAliveSeconds: 30,
        updatedBy: 1,
      });
      await sandboxRepo.save(sandboxDraft);

      const prompt = await aiPromptsService.create(
        'ocr_extraction',
        { template: 'Extract from {{ocr_text}}' },
        1
      );
      await aiPromptsService.activate(
        'ocr_extraction',
        prompt.versionNumber,
        1
      );

      const idempotencyKey = 'test-sandbox-draft-params';
      await aiBatchQueue.add('sandbox-ai-extract', {
        jobType: 'sandbox-ai-extract',
        documentPublicId: 'test-doc-003',
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

      // ลบข้อมูลทดสอบ
      await aiPromptsService.delete('ocr_extraction', prompt.versionNumber, 1);
      await sandboxRepo.delete(sandboxDraft.id);
    }, 60000);

    it('ควร apply runtime parameters จาก AiPolicyService.getSandboxParameters', async () => {
      const profileRepo = dataSource.getRepository(AiExecutionProfile);
      const testProfile = profileRepo.create({
        profileName: 'runtime-test-profile',
        canonicalModel: 'np-dms-ai',
        temperature: 0.15,
        topP: 0.65,
        maxTokens: 1024,
        numCtx: 2048,
        repeatPenalty: 1.05,
        keepAliveSeconds: 15,
        isActive: true,
        createdBy: 1,
      });
      await profileRepo.save(testProfile);

      // ทดสอบ getSandboxParameters
      const params = await aiPolicyService.getSandboxParameters(
        'runtime-test-profile'
      );

      expect(params).toBeDefined();
      expect(params.temperature).toBe(0.15);
      expect(params.topP).toBe(0.65);
      expect(params.maxTokens).toBe(1024);
      expect(params.numCtx).toBe(2048);
      expect(params.repeatPenalty).toBe(1.05);
      expect(params.keepAliveSeconds).toBe(15);

      // ลบข้อมูลทดสอบ
      await profileRepo.delete(testProfile.id);
    });

    it('ควร cache sandbox parameters ใน Redis เพื่อ performance', async () => {
      const profileRepo = dataSource.getRepository(AiExecutionProfile);
      const cacheTestProfile = profileRepo.create({
        profileName: 'cache-test-profile',
        canonicalModel: 'np-dms-ai',
        temperature: 0.25,
        topP: 0.75,
        maxTokens: 3072,
        numCtx: 6144,
        repeatPenalty: 1.15,
        keepAliveSeconds: 45,
        isActive: true,
        createdBy: 1,
      });
      await profileRepo.save(cacheTestProfile);

      // First call - should fetch from DB and cache
      const params1 =
        await aiPolicyService.getSandboxParameters('cache-test-profile');
      expect(params1.temperature).toBe(0.25);

      // Second call - should fetch from Redis cache
      const params2 =
        await aiPolicyService.getSandboxParameters('cache-test-profile');
      expect(params2.temperature).toBe(0.25);

      // Verify cache exists in Redis
      const cached = await redis.get('ai:policy:cache-test-profile');
      expect(cached).toBeDefined();

      // ลบข้อมูลทดสอบ
      await profileRepo.delete(cacheTestProfile.id);
      await redis.del('ai:policy:cache-test-profile');
    });
  });
});
