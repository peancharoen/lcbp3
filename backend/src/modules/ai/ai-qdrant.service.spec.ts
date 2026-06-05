// File: backend/src/modules/ai/ai-qdrant.service.spec.ts
// Change Log:
// - 2026-06-05: สร้าง unit test สำหรับ AiQdrantService ครอบคลุม deleteByDocumentPublicId (T4)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AiQdrantService } from './qdrant.service';

describe('AiQdrantService', () => {
  let service: AiQdrantService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    mockConfigService = {
      get: jest.fn(),
    } as unknown as jest.Mocked<ConfigService>;

    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'AI_QDRANT_URL' || key === 'QDRANT_URL') {
        return 'http://localhost:6333';
      }
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiQdrantService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AiQdrantService>(AiQdrantService);
  });

  it('ควรถูกสร้างขึ้นสำเร็จ', () => {
    expect(service).toBeDefined();
  });

  describe('deleteByDocumentPublicId', () => {
    it('ควร throw error ถ้า projectPublicId ว่าง', async () => {
      await expect(
        service.deleteByDocumentPublicId('', 'doc-uuid-123')
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควร throw error ถ้า projectPublicId เป็น undefined', async () => {
      await expect(
        service.deleteByDocumentPublicId(
          undefined as unknown as string,
          'doc-uuid-123'
        )
      ).rejects.toThrow('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    });

    it('ควรเรียก Qdrant delete ด้วย filter ที่ถูกต้อง (project_public_id + doc_public_id)', async () => {
      // Mock QdrantClient.delete method
      const mockDelete = jest.fn().mockResolvedValue(undefined);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      (service as any).client.delete = mockDelete;

      await service.deleteByDocumentPublicId('proj-uuid-456', 'doc-uuid-123');

      expect(mockDelete).toHaveBeenCalledWith('lcbp3_vectors', {
        wait: true,
        filter: {
          must: [
            { key: 'project_public_id', match: { value: 'proj-uuid-456' } },
            { key: 'doc_public_id', match: { value: 'doc-uuid-123' } },
          ],
        },
      });
    });
  });
});
