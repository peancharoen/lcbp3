// File: backend/src/modules/ai/services/rag-retrieval-guard.service.spec.ts
// Change Log:
// - 2026-09-10: เพิ่ม RED tests สำหรับ RagRetrievalGuardService batch ACTIVE validation (Feature 254, Phase 4 US2, T035)
// - 2026-09-12: T071 เพิ่ม RED tests สำหรับ classification-aware retrieval filtering (Feature 254, Phase 7 US5)

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { In } from 'typeorm';
import { RagAttachmentGeneration } from '../entities/rag-attachment-generation.entity';
import { RagRetrievalGuardService } from './rag-retrieval-guard.service';
import { AiVectorSearchResult } from '../qdrant.service';
import { AbilityFactory } from '../../../common/auth/casl/ability.factory';
import { User } from '../../user/entities/user.entity';

/**
 * RED tests สำหรับ RagRetrievalGuardService
 * - Service ยังไม่มีอยู่ (จะถูกสร้างใน T039 โดย split จาก rag-retrieval.service.ts)
 * - ครอบคลุม batch ACTIVE-only validation สำหรับ generation UUIDs
 */
/**
 * Factory สร้าง mock User สำหรับ CASL ability check
 * @param userId - internal INT id
 * @param userPublicId - UUIDv7 publicId
 */
const createMockUser = (userId: number, userPublicId: string): User =>
  ({
    user_id: userId,
    publicId: userPublicId,
    username: 'test-user',
    assignments: [],
  }) as unknown as User;

describe('RagRetrievalGuardService', () => {
  let service: RagRetrievalGuardService;
  const generationRepository = { find: jest.fn() };
  const mockAbility = { can: jest.fn() };
  const abilityFactory = {
    createForUser: jest.fn().mockReturnValue(mockAbility),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // default: ผู้ใช้ทั่วไปไม่มีสิทธิ์ override (can() false)
    mockAbility.can.mockReturnValue(false);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagRetrievalGuardService,
        {
          provide: getRepositoryToken(RagAttachmentGeneration),
          useValue: generationRepository,
        },
        { provide: AbilityFactory, useValue: abilityFactory },
      ],
    }).compile();
    service = module.get<RagRetrievalGuardService>(RagRetrievalGuardService);
  });

  /**
   * Helper สำหรับจำลอง repository.find ที่กรองเฉพาะ ACTIVE generation
   * ลากเลียนแบบพฤติกรรมจริงของ TypeORM (คืนเฉพาะแถวที่ status = ACTIVE)
   */
  const mockActiveOnly = (activeUuids: string[]): void => {
    generationRepository.find.mockImplementation(
      (opts: {
        where: { generationUuid: { values: string[] }; status: string };
      }) => {
        const requested = opts.where.generationUuid.values;
        return Promise.resolve(
          requested
            .filter((uuid) => activeUuids.includes(uuid))
            .map((uuid) => ({ generationUuid: uuid }))
        );
      }
    );
  };

  describe('filterActiveGenerations', () => {
    it('returns only ACTIVE generation UUIDs from a batch', async () => {
      // ตั้งค่า: gen-a และ gen-c เป็น ACTIVE, gen-b เป็น RETIRED
      mockActiveOnly(['gen-a', 'gen-c']);
      const result = await service.filterActiveGenerations([
        'gen-a',
        'gen-b',
        'gen-c',
      ]);
      expect(result).toEqual(['gen-a', 'gen-c']);
      // ต้อง query ด้วย In() และ status = ACTIVE
      expect(generationRepository.find).toHaveBeenCalledWith({
        where: {
          generationUuid: In(['gen-a', 'gen-b', 'gen-c']),
          status: 'ACTIVE',
        },
        select: ['generationUuid'],
      });
    });

    it('skips RETIRED, FAILED, BUILDING, and missing generations', async () => {
      // ไม่มี generation ใด ACTIVE เลยในรอบนี้
      mockActiveOnly([]);
      const result = await service.filterActiveGenerations([
        'gen-retired',
        'gen-failed',
        'gen-building',
        'gen-missing',
      ]);
      expect(result).toEqual([]);
    });

    it('returns empty array when no generations are ACTIVE', async () => {
      mockActiveOnly([]);
      const result = await service.filterActiveGenerations([
        'gen-retired',
        'gen-failed',
      ]);
      expect(result).toEqual([]);
    });

    it('handles empty input', async () => {
      mockActiveOnly([]);
      const result = await service.filterActiveGenerations([]);
      expect(result).toEqual([]);
      // ไม่ควรเรียก repository เมื่อ input ว่าง
      expect(generationRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('batch validation with Qdrant results', () => {
    it('returns only chunks whose generation is ACTIVE', async () => {
      // ตั้งค่า: gen-active เป็น ACTIVE, gen-retired ไม่ใช่
      mockActiveOnly(['gen-active']);

      const rawResults: AiVectorSearchResult[] = [
        {
          pointId: 'p1',
          score: 0.95,
          payload: {
            chunk_public_id: 'chunk-active-1',
            generation_uuid: 'gen-active',
          },
        },
        {
          pointId: 'p2',
          score: 0.9,
          payload: {
            chunk_public_id: 'chunk-retired-1',
            generation_uuid: 'gen-retired',
          },
        },
        {
          pointId: 'p3',
          score: 0.85,
          payload: {
            chunk_public_id: 'chunk-active-2',
            generation_uuid: 'gen-active',
          },
        },
      ];

      const filtered = await service.filterActiveChunksFromResults(rawResults);

      // ควรเก็บเฉพาะ chunks ที่อยู่ใน gen-active
      expect(filtered).toHaveLength(2);
      const chunkIds = filtered.map((r) => r.payload.chunk_public_id as string);
      expect(chunkIds).toEqual(['chunk-active-1', 'chunk-active-2']);
    });
  });

  // ==========================================================
  // T071 — Classification-aware retrieval filtering
  // กรอง chunks ที่ classification เกินกว่า clearance ของผู้ใช้ (ADR-016)
  // ==========================================================
  describe('classification-aware filtering (T071)', () => {
    /**
     * Helper สร้าง Qdrant result พร้อม classification ใน payload
     */
    const makeResult = (
      chunkId: string,
      classification: string,
      score = 0.9
    ): AiVectorSearchResult => ({
      pointId: `p-${chunkId}`,
      score,
      payload: {
        chunk_public_id: chunkId,
        generation_uuid: 'gen-active',
        classification,
      },
    });

    describe('getUserClassificationClearance', () => {
      it('returns RESTRICTED when user has document.classification_override', () => {
        // ผู้ใช้มีสิทธิ์ override → ability.can('classification_override','document') true
        mockAbility.can.mockImplementation(
          (action: string, subject: string) =>
            action === 'classification_override' && subject === 'document'
        );
        const user = createMockUser(7, '0195a1b2-c3d4-7000-8000-abc123def456');
        expect(service.getUserClassificationClearance(user)).toBe('RESTRICTED');
      });

      it('returns RESTRICTED when user has system.manage_all (Superadmin)', () => {
        // Superadmin ผ่าน system.manage_all → ability.can('manage','all') true
        mockAbility.can.mockImplementation(
          (action: string, subject: string) =>
            action === 'manage' && subject === 'all'
        );
        const superadmin = createMockUser(
          1,
          '0195s1p2-e3f4-7000-8000-abc123def456'
        );
        expect(service.getUserClassificationClearance(superadmin)).toBe(
          'RESTRICTED'
        );
      });

      it('returns INTERNAL for authenticated user without override', () => {
        // ผู้ใช้ทั่วไปไม่มีสิทธิ์ override → can() false → default INTERNAL
        mockAbility.can.mockReturnValue(false);
        const user = createMockUser(42, '0195c1d2-e3f4-7000-8000-abc123def456');
        expect(service.getUserClassificationClearance(user)).toBe('INTERNAL');
      });
    });

    describe('filterByClassification', () => {
      it('PUBLIC chunk accessible to all clearance levels', () => {
        const chunks = [makeResult('chunk-pub', 'PUBLIC')];
        // ผู้ใช้ clearance ต่ำสุด (PUBLIC) ยังเข้าถึง PUBLIC chunk ได้
        expect(service.filterByClassification(chunks, 'PUBLIC')).toEqual(
          chunks
        );
        // ผู้ใช้ clearance สูงสุด (RESTRICTED) เข้าถึงได้เช่นกัน
        expect(service.filterByClassification(chunks, 'RESTRICTED')).toEqual(
          chunks
        );
      });

      it('INTERNAL chunk accessible to authenticated (INTERNAL) users', () => {
        const chunks = [makeResult('chunk-int', 'INTERNAL')];
        // INTERNAL clearance เข้าถึง INTERNAL chunk ได้
        expect(service.filterByClassification(chunks, 'INTERNAL')).toEqual(
          chunks
        );
        // RESTRICTED clearance เข้าถึง INTERNAL chunk ได้
        expect(service.filterByClassification(chunks, 'RESTRICTED')).toEqual(
          chunks
        );
      });

      it('CONFIDENTIAL chunk filtered for INTERNAL-only users', () => {
        const chunks = [makeResult('chunk-conf', 'CONFIDENTIAL')];
        // INTERNAL clearance ไม่สามารถเข้าถึง CONFIDENTIAL chunk ได้
        expect(service.filterByClassification(chunks, 'INTERNAL')).toEqual([]);
        // CONFIDENTIAL clearance เข้าถึงได้
        expect(service.filterByClassification(chunks, 'CONFIDENTIAL')).toEqual(
          chunks
        );
      });

      it('RESTRICTED chunk filtered for non-override (INTERNAL) users', () => {
        const chunks = [makeResult('chunk-rest', 'RESTRICTED')];
        // INTERNAL clearance ไม่สามารถเข้าถึง RESTRICTED chunk ได้
        expect(service.filterByClassification(chunks, 'INTERNAL')).toEqual([]);
        // CONFIDENTIAL clearance ก็ไม่สามารถเข้าถึง RESTRICTED chunk ได้
        expect(service.filterByClassification(chunks, 'CONFIDENTIAL')).toEqual(
          []
        );
        // เฉพาะ RESTRICTED clearance เท่านั้นที่เข้าถึงได้
        expect(service.filterByClassification(chunks, 'RESTRICTED')).toEqual(
          chunks
        );
      });

      it('override-permission (RESTRICTED clearance) users access all classifications', () => {
        const chunks = [
          makeResult('chunk-pub', 'PUBLIC'),
          makeResult('chunk-int', 'INTERNAL'),
          makeResult('chunk-conf', 'CONFIDENTIAL'),
          makeResult('chunk-rest', 'RESTRICTED'),
        ];
        // ผู้ใช้ที่มีสิทธิ์ override → clearance RESTRICTED → เข้าถึงทุกระดับได้
        expect(service.filterByClassification(chunks, 'RESTRICTED')).toEqual(
          chunks
        );
        expect(
          service.filterByClassification(chunks, 'RESTRICTED')
        ).toHaveLength(4);
      });

      it('filters mixed chunks keeping only those within clearance', () => {
        const chunks = [
          makeResult('chunk-pub', 'PUBLIC'),
          makeResult('chunk-int', 'INTERNAL'),
          makeResult('chunk-conf', 'CONFIDENTIAL'),
          makeResult('chunk-rest', 'RESTRICTED'),
        ];
        // INTERNAL clearance → เก็บเฉพาะ PUBLIC และ INTERNAL
        const filtered = service.filterByClassification(chunks, 'INTERNAL');
        const ids = filtered.map((r) => r.payload.chunk_public_id as string);
        expect(ids).toEqual(['chunk-pub', 'chunk-int']);
      });

      it('treats missing classification payload as INTERNAL default', () => {
        // chunk ที่ไม่มี classification ใน payload → default INTERNAL
        const chunks: AiVectorSearchResult[] = [
          {
            pointId: 'p-no-class',
            score: 0.9,
            payload: {
              chunk_public_id: 'chunk-no-class',
              generation_uuid: 'gen-active',
            },
          },
        ];
        // INTERNAL clearance เข้าถึงได้ (default)
        expect(service.filterByClassification(chunks, 'INTERNAL')).toEqual(
          chunks
        );
        // PUBLIC clearance เข้าถึงไม่ได้ (INTERNAL > PUBLIC)
        expect(service.filterByClassification(chunks, 'PUBLIC')).toEqual([]);
      });
    });
  });
});
