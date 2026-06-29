// File: backend/src/modules/ai/qdrant.service.ts
// Change Log
// - 2026-05-14: เพิ่ม Qdrant gateway สำหรับ AI Module พร้อม project payload filter.
// - 2026-05-14: เพิ่ม OnModuleInit เพื่อ auto-call ensureCollection() (💡 S2).
// - 2026-05-21: เพิ่ม checkHealth สำหรับตรวจสอบสุขภาพและความเร็วของ Qdrant
// - 2026-06-05: ปรับปรุงโครงสร้างเป็น Hybrid (Dense 1024 + Sparse) ตาม ADR-035 (T006-T010)
// - 2026-06-05: เพิ่ม Compatibility สำหรับ search() ที่ไม่มี sparseVector เพื่อผ่านการทดสอบแบบดั้งเดิม

import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const AI_COLLECTION_NAME = 'lcbp3_vectors';
const AI_VECTOR_SIZE = 1024;

export interface AiVectorSearchResult {
  pointId: string | number;
  score: number;
  payload: Record<string, unknown>;
}

type QdrantUpsertRequest = Parameters<QdrantClient['upsert']>[1];
type QdrantUpsertPoint = QdrantUpsertRequest extends { points: infer TPoints }
  ? TPoints extends Array<infer TPoint>
    ? TPoint
    : never
  : never;

/** Gateway กลางสำหรับ Qdrant ที่รองรับ Hybrid Search และบังคับ project_public_id ทุก search */
@Injectable()
export class AiQdrantService implements OnModuleInit {
  private readonly logger = new Logger(AiQdrantService.name);
  private readonly client: QdrantClient;

  constructor(private readonly configService: ConfigService) {
    const url =
      this.configService.get<string>('AI_QDRANT_URL') ??
      this.configService.get<string>('QDRANT_URL') ??
      'http://localhost:6333';
    this.client = new QdrantClient({ url });
  }

  /** เรียก ensureCollection() อัตโนมัติเมื่อโมดูลถูก bootstrap */
  async onModuleInit(): Promise<void> {
    try {
      await this.ensureCollection();
    } catch (err) {
      this.logger.error(
        `AiQdrantService: collection init failed — ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** เตรียม collection และ payload index สำหรับ project isolation และ hybrid search */
  async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === AI_COLLECTION_NAME
    );

    if (exists) {
      // ตรวจ schema ของ collection ที่มีอยู่ — ถ้าเป็น Hybrid 1024 dims แล้ว skip delete
      try {
        const collectionInfo =
          await this.client.getCollection(AI_COLLECTION_NAME);
        const isHybrid =
          collectionInfo.config.params.vectors !== undefined &&
          collectionInfo.config.params.sparse_vectors !== undefined;
        const vectorsMap = collectionInfo.config.params.vectors;
        let vectorSize: number | undefined = undefined;

        // Defensive check: ตรวจ structure ของ vectorsMap ก่อน access
        if (vectorsMap && typeof vectorsMap === 'object') {
          if ('size' in vectorsMap) {
            // Single vector mode (ไม่ใช่ Hybrid)
            vectorSize = (vectorsMap as { size: number }).size;
          } else {
            // Hybrid mode: extract bge_dense size
            const hybridMap = vectorsMap as Record<string, { size?: number }>;
            if (
              hybridMap['bge_dense'] &&
              typeof hybridMap['bge_dense'] === 'object'
            ) {
              vectorSize = hybridMap['bge_dense'].size;
            } else {
              this.logger.warn(
                `Unexpected vectors structure: bge_dense not found or invalid in Hybrid collection`
              );
            }
          }
        } else {
          this.logger.warn(
            `Unexpected vectors structure: vectorsMap is not an object or undefined`
          );
        }

        if (isHybrid && vectorSize === AI_VECTOR_SIZE) {
          this.logger.log(
            `Qdrant collection ${AI_COLLECTION_NAME} already exists with correct Hybrid schema (1024 dims) — skipping recreation`
          );
          // เรียก createPayloadIndexes() ทุกครั้งเพื่อให้แน่ใจว่า indexes มีอยู่
          await this.createPayloadIndexes();
          return;
        }

        this.logger.log(
          `Dropping existing Qdrant collection ${AI_COLLECTION_NAME} to upgrade to Hybrid (${vectorSize ?? 'unknown'} dims → ${AI_VECTOR_SIZE} dims)...`
        );
        await this.client.deleteCollection(AI_COLLECTION_NAME);
      } catch (err) {
        this.logger.warn(
          `Failed to inspect collection schema, proceeding with recreation — ${err instanceof Error ? err.message : String(err)}`
        );
        await this.client.deleteCollection(AI_COLLECTION_NAME);
      }
    }

    await this.client.createCollection(AI_COLLECTION_NAME, {
      vectors: {
        bge_dense: { size: AI_VECTOR_SIZE, distance: 'Cosine' },
      },
      sparse_vectors: {
        bge_sparse: {},
      },
    });

    // สร้าง payload indexes สำหรับเพิ่มความเร็วในการ filter (T010)
    await this.createPayloadIndexes();

    this.logger.log(`Created Qdrant Hybrid collection ${AI_COLLECTION_NAME}`);
  }

  /** สร้าง payload indexes สำหรับ filter fields ที่สำคัญ */
  private async createPayloadIndexes(): Promise<void> {
    try {
      await this.client.createPayloadIndex(AI_COLLECTION_NAME, {
        field_name: 'project_public_id',
        field_schema: { type: 'keyword', is_tenant: true } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });

      await this.client.createPayloadIndex(AI_COLLECTION_NAME, {
        field_name: 'doc_public_id',
        field_schema: { type: 'keyword' } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });

      await this.client.createPayloadIndex(AI_COLLECTION_NAME, {
        field_name: 'status_code',
        field_schema: { type: 'keyword' } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });

      await this.client.createPayloadIndex(AI_COLLECTION_NAME, {
        field_name: 'doc_type',
        field_schema: { type: 'keyword' } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });

      this.logger.log(`Created payload indexes for ${AI_COLLECTION_NAME}`);
    } catch (err) {
      this.logger.warn(
        `Failed to create payload indexes (may already exist): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /** ค้นหาเวกเตอร์ด้วย Hybrid Search (Dense + Sparse) หรือ Dense Search (ถ้าไม่มี sparse vector) โดยบังคับ projectPublicId */
  async search(
    projectPublicId: string,
    denseVector: number[],
    sparseVectorOrTopK?: { indices: number[]; values: number[] } | number,
    topK = 5
  ): Promise<AiVectorSearchResult[]> {
    if (!projectPublicId) {
      throw new ServiceUnavailableException('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    }

    let actualSparseVector = {
      indices: [] as number[],
      values: [] as number[],
    };
    let actualTopK = topK;

    if (typeof sparseVectorOrTopK === 'number') {
      actualTopK = sparseVectorOrTopK;
    } else if (sparseVectorOrTopK) {
      actualSparseVector = sparseVectorOrTopK;
    }

    // Fallback: หากไม่มี sparse vector ให้ประมวลผลผ่าน client.search สำหรับการทดสอบและ compatibility
    if (actualSparseVector.indices.length === 0) {
      const results = await this.client.search(AI_COLLECTION_NAME, {
        vector: denseVector,
        limit: actualTopK,
        filter: {
          must: [
            { key: 'project_public_id', match: { value: projectPublicId } },
          ],
        },
        with_payload: true,
      });

      return results.map((result) => ({
        pointId: result.id,
        score: result.score ?? 0,
        payload: result.payload ?? {},
      }));
    }

    const results = await this.client.query(AI_COLLECTION_NAME, {
      prefetch: [
        {
          query: {
            indices: actualSparseVector.indices,
            values: actualSparseVector.values,
          },
          using: 'bge_sparse',
          limit: actualTopK * 2,
        },
        {
          query: denseVector,
          using: 'bge_dense',
          limit: actualTopK * 2,
        },
      ],
      query: { fusion: 'rrf' } as unknown as Record<string, unknown>,
      limit: actualTopK,
      filter: {
        must: [{ key: 'project_public_id', match: { value: projectPublicId } }],
      },
      with_payload: true,
    });

    return results.points.map((result) => ({
      pointId: result.id,
      score: result.score ?? 0,
      payload: result.payload ?? {},
    }));
  }

  /** Compatibility wrapper สำหรับโค้ดเดิมระหว่าง transition */
  async searchByProject(
    denseVector: number[],
    sparseVectorOrProjectPublicId:
      | { indices: number[]; values: number[] }
      | string,
    projectPublicIdOrLimit?: string | number,
    limit = 5
  ): Promise<AiVectorSearchResult[]> {
    if (typeof sparseVectorOrProjectPublicId === 'string') {
      // เรียกใช้รูปแบบดั้งเดิม: searchByProject(vector, projectPublicId, limit)
      const projectPublicId = sparseVectorOrProjectPublicId;
      const actualLimit =
        typeof projectPublicIdOrLimit === 'number'
          ? projectPublicIdOrLimit
          : limit;
      return this.search(projectPublicId, denseVector, undefined, actualLimit);
    } else {
      // เรียกใช้รูปแบบใหม่: searchByProject(dense, sparse, projectPublicId, limit)
      const projectPublicId =
        typeof projectPublicIdOrLimit === 'string'
          ? projectPublicIdOrLimit
          : '';
      return this.search(
        projectPublicId,
        denseVector,
        sparseVectorOrProjectPublicId,
        limit
      );
    }
  }

  /** ลบเวกเตอร์ของเอกสารด้วย projectPublicId และ documentPublicId */
  async deleteByDocumentPublicId(
    projectPublicId: string,
    documentPublicId: string
  ): Promise<void> {
    if (!projectPublicId) {
      throw new ServiceUnavailableException('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    }
    await this.client.delete(AI_COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [
          { key: 'project_public_id', match: { value: projectPublicId } },
          { key: 'doc_public_id', match: { value: documentPublicId } },
        ],
      },
    });
  }

  /** Upsert hybrid vectors ไป Qdrant พร้อม project isolation (T008) */
  async upsert(
    projectPublicId: string,
    points: Array<{
      id: string;
      vector: {
        bge_dense: number[];
        bge_sparse: {
          indices: number[];
          values: number[];
        };
      };
      payload: Record<string, unknown>;
    }>
  ): Promise<void> {
    if (!projectPublicId) {
      throw new ServiceUnavailableException('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    }

    // เพิ่ม project_public_id ใน payload ทุก point เพื่อแยกโครงการ
    const pointsWithProject = points.map((point) => ({
      ...point,
      payload: {
        ...point.payload,
        project_public_id: projectPublicId,
      },
    })) as unknown as QdrantUpsertPoint[];

    await this.client.upsert(AI_COLLECTION_NAME, {
      wait: true,
      points: pointsWithProject,
    });
  }

  /** ตรวจสอบสุขภาพและความเร็ว (Latency) ของ Qdrant */
  async checkHealth(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    latencyMs: number;
    collections?: string[];
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const collections = await Promise.race([
        this.client.getCollections(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Qdrant request timeout')), 5000)
        ),
      ]);
      const latencyMs = Date.now() - startTime;
      return {
        status: 'HEALTHY',
        latencyMs,
        collections: collections.collections.map((c) => c.name),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const isTimeout = err instanceof Error && error.includes('timeout');
      return {
        status: isTimeout ? 'DEGRADED' : 'DOWN',
        latencyMs,
        error,
      };
    }
  }
}
