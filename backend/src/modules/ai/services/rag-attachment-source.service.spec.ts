// File: backend/src/modules/ai/services/rag-attachment-source.service.spec.ts
// Change Log:
// - 2026-09-10: T024 rename RagOwnerContextService → RagAttachmentSourceService (Feature 254)
// - 2026-09-09: เพิ่ม integration tests สำหรับ owner context resolution (Feature 254)

import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { RagAttachmentSourceService } from './rag-attachment-source.service';

describe('RagAttachmentSourceService', () => {
  let service: RagAttachmentSourceService;
  const dataSource = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagAttachmentSourceService,
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();
    service = module.get<RagAttachmentSourceService>(
      RagAttachmentSourceService
    );
  });

  it('resolves owner context via correspondence path', async () => {
    dataSource.query.mockResolvedValue([
      {
        owner_public_id: 'corr-uuid-1',
        project_public_id: 'proj-uuid-1',
        doc_type: 'IN',
        doc_number: 'CORR-001',
      },
    ]);

    const result = await service.resolveFromAttachment('att-1');

    expect(result).toEqual({
      ownerType: 'CORRESPONDENCE',
      ownerPublicId: 'corr-uuid-1',
      projectPublicId: 'proj-uuid-1',
      docType: 'IN',
      docNumber: 'CORR-001',
    });
  });

  it('returns null when no correspondence link found and falls back to workflow', async () => {
    dataSource.query
      .mockResolvedValueOnce([]) // correspondence path
      .mockResolvedValueOnce([
        {
          entity_type: 'correspondence',
          owner_public_id: 'corr-uuid-2',
          project_public_id: 'proj-uuid-2',
        },
      ]);

    const result = await service.resolveFromAttachment('att-2');

    expect(result).toEqual({
      ownerType: 'CORRESPONDENCE',
      ownerPublicId: 'corr-uuid-2',
      projectPublicId: 'proj-uuid-2',
    });
  });

  it('returns null when both paths fail', async () => {
    dataSource.query.mockResolvedValue([]);

    const result = await service.resolveFromAttachment('att-3');

    expect(result).toBeNull();
  });

  it('returns null when workflow path has no project_public_id', async () => {
    dataSource.query
      .mockResolvedValueOnce([]) // correspondence path
      .mockResolvedValueOnce([
        {
          entity_type: 'rfa',
          owner_public_id: 'rfa-1',
          project_public_id: null,
        },
      ]);

    const result = await service.resolveFromAttachment('att-4');

    expect(result).toBeNull();
  });

  it('returns null when correspondence query throws', async () => {
    dataSource.query.mockRejectedValue(new Error('DB error'));

    const result = await service.resolveFromAttachment('att-5');

    expect(result).toBeNull();
  });
});
