// File: backend/src/modules/ai/services/rag-page.service.spec.ts
// Change Log:
// - 2026-09-14: T059 (Feature 254 Phase 6 US4) — tests สำหรับ RagPageService
//   ครอบคลุม: persistSegments (generation-scoped offsets), findByGeneration, deleteByGeneration

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RagAttachmentPage } from '../entities/rag-attachment-page.entity';
import { RagTextSegment } from '../interfaces/rag-attachment.types';
import { RagPageService } from './rag-page.service';

describe('RagPageService', () => {
  let service: RagPageService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(
        (value: Partial<RagAttachmentPage>) =>
          ({ ...value }) as RagAttachmentPage
      ),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagPageService,
        {
          provide: getRepositoryToken(RagAttachmentPage),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<RagPageService>(RagPageService);
  });

  describe('persistSegments', () => {
    it('ควรสร้าง page records สำหรับแต่ละ segment', async () => {
      const segments: RagTextSegment[] = [
        {
          segmentType: 'PAGE',
          segmentNumber: 1,
          segmentLabel: 'Page 1',
          sourceLocator: 'doc.pdf#page=1',
          text: 'page one text',
        },
        {
          segmentType: 'PAGE',
          segmentNumber: 2,
          segmentLabel: 'Page 2',
          sourceLocator: 'doc.pdf#page=2',
          text: 'page two text',
        },
      ];

      const result = await service.persistSegments(
        'gen-uuid-1',
        'att-uuid-1',
        segments
      );

      expect(result).toHaveLength(2);
      expect(repository.create).toHaveBeenCalledTimes(2);
      expect(repository.save).toHaveBeenCalledTimes(1);
    });

    it('ควรคำนวณ normalized offsets แบบ generation-scoped (ต่อเนื่องข้าม segments)', async () => {
      const segments: RagTextSegment[] = [
        {
          segmentType: 'PAGE',
          segmentNumber: 1,
          text: 'hello',
        },
        {
          segmentType: 'PAGE',
          segmentNumber: 2,
          text: 'world',
        },
      ];

      const result = await service.persistSegments(
        'gen-uuid-2',
        'att-uuid-2',
        segments
      );

      // segment 1: offset 0-5 (hello = 5 chars)
      expect(result[0].normalizedStartOffset).toBe('0');
      expect(result[0].normalizedEndOffset).toBe('5');
      // segment 2: offset 5-10 (world = 5 chars, ต่อจาก segment 1)
      expect(result[1].normalizedStartOffset).toBe('5');
      expect(result[1].normalizedEndOffset).toBe('10');
    });

    it('ควรสร้าง pageUuid แบบ UUIDv7 สำหรับแต่ละ segment', async () => {
      const segments: RagTextSegment[] = [
        { segmentType: 'WHOLE_DOCUMENT', text: 'whole text' },
      ];

      const result = await service.persistSegments(
        'gen-uuid-3',
        'att-uuid-3',
        segments
      );

      expect(result[0].pageUuid).toBeDefined();
      expect(typeof result[0].pageUuid).toBe('string');
      expect(result[0].pageUuid.length).toBe(36); // UUID format
    });

    it('ควร preserve segmentType, segmentNumber, segmentLabel, sourceLocator', async () => {
      const segments: RagTextSegment[] = [
        {
          segmentType: 'SECTION',
          segmentNumber: 3,
          segmentLabel: 'Introduction',
          sourceLocator: 'doc.pdf#section=intro',
          text: 'intro text',
        },
      ];

      const result = await service.persistSegments(
        'gen-uuid-4',
        'att-uuid-4',
        segments
      );

      expect(result[0].segmentType).toBe('SECTION');
      expect(result[0].segmentNumber).toBe(3);
      expect(result[0].segmentLabel).toBe('Introduction');
      expect(result[0].sourceLocator).toBe('doc.pdf#section=intro');
    });

    it('ควร return empty array เมื่อ segments ว่าง', async () => {
      const result = await service.persistSegments(
        'gen-uuid-5',
        'att-uuid-5',
        []
      );

      expect(result).toHaveLength(0);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('ควร handle SHEET segments ที่ไม่มี segmentLabel', async () => {
      const segments: RagTextSegment[] = [
        {
          segmentType: 'SHEET',
          segmentNumber: 1,
          text: 'sheet data',
        },
      ];

      const result = await service.persistSegments(
        'gen-uuid-6',
        'att-uuid-6',
        segments
      );

      expect(result[0].segmentType).toBe('SHEET');
      expect(result[0].segmentNumber).toBe(1);
      expect(result[0].segmentLabel).toBeUndefined();
    });
  });

  describe('findByGeneration', () => {
    it('ควรดึง page records ตาม generationUuid', async () => {
      const mockPages: RagAttachmentPage[] = [
        {
          pageUuid: 'page-1',
          generationUuid: 'gen-uuid',
          attachmentUuid: 'att-uuid',
          segmentType: 'PAGE',
          segmentNumber: 1,
          segmentLabel: 'Page 1',
          sourceLocator: null,
          normalizedText: 'text',
          normalizedStartOffset: '0',
          normalizedEndOffset: '4',
          createdAt: new Date(),
        } as RagAttachmentPage,
      ];
      repository.find.mockResolvedValue(mockPages);

      const result = await service.findByGeneration('gen-uuid');

      expect(result).toHaveLength(1);
      expect(repository.find).toHaveBeenCalledWith({
        where: { generationUuid: 'gen-uuid' },
        order: { normalizedStartOffset: 'ASC' },
      });
    });
  });

  describe('deleteByGeneration', () => {
    it('ควรลบ page records ตาม generationUuid', async () => {
      await service.deleteByGeneration('gen-uuid');

      expect(repository.delete).toHaveBeenCalledWith({
        generationUuid: 'gen-uuid',
      });
    });
  });
});
