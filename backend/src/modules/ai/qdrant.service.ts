// File: src/modules/ai/qdrant.service.ts
// Change Log
// - 2026-05-14: เพิ่ม Qdrant gateway สำหรับ AI Module พร้อม project payload filter.
// - 2026-05-14: เพิ่ม OnModuleInit เพื่อ auto-call ensureCollection() (💡 S2).
import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

const AI_COLLECTION_NAME = 'lcbp3_vectors';
const AI_VECTOR_SIZE = 768;

export interface AiVectorSearchResult {
  pointId: string | number;
  score: number;
  payload: Record<string, unknown>;
}

/** Gateway กลางสำหรับ Qdrant ที่บังคับ project_public_id ทุก search */
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

  /** เตรียม collection และ tenant payload index สำหรับ project isolation */
  async ensureCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (collection) => collection.name === AI_COLLECTION_NAME
    );

    if (!exists) {
      await this.client.createCollection(AI_COLLECTION_NAME, {
        vectors: { size: AI_VECTOR_SIZE, distance: 'Cosine' },
      });
      await this.client.createPayloadIndex(AI_COLLECTION_NAME, {
        field_name: 'project_public_id',
        field_schema: { type: 'keyword', is_tenant: true } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });
      this.logger.log(`Created Qdrant collection ${AI_COLLECTION_NAME}`);
    }
  }

  /** ค้นหา vector โดยบังคับ projectPublicId เป็น parameter แรกตาม ADR-023A */
  async search(
    projectPublicId: string,
    vector: number[],
    topK = 5
  ): Promise<AiVectorSearchResult[]> {
    if (!projectPublicId) {
      throw new ServiceUnavailableException('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    }

    const results = await this.client.search(AI_COLLECTION_NAME, {
      vector,
      limit: topK,
      filter: {
        must: [{ key: 'project_public_id', match: { value: projectPublicId } }],
      },
      with_payload: true,
    });

    return results.map((result) => ({
      pointId: result.id,
      score: result.score,
      payload: result.payload ?? {},
    }));
  }

  /** Compatibility wrapper สำหรับ code เดิมระหว่าง transition ไป contract ใหม่ */
  async searchByProject(
    vector: number[],
    projectPublicId: string,
    limit: number
  ): Promise<AiVectorSearchResult[]> {
    return this.search(projectPublicId, vector, limit);
  }

  /** ลบ vector ของเอกสารด้วย publicId ผ่าน queue processor ในขั้นถัดไป */
  async deleteByDocumentPublicId(documentPublicId: string): Promise<void> {
    await this.client.delete(AI_COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'public_id', match: { value: documentPublicId } }],
      },
    });
  }

  /** Upsert vectors ไป Qdrant พร้อม project isolation (T021) */
  async upsert(
    projectPublicId: string,
    points: Array<{
      id: string;
      vector: number[];
      payload: Record<string, unknown>;
    }>
  ): Promise<void> {
    if (!projectPublicId) {
      throw new ServiceUnavailableException('AI_QDRANT_PROJECT_SCOPE_REQUIRED');
    }

    // เพิ่ม project_public_id ใน payload ทุก point เพื่อ isolation
    const pointsWithProject = points.map((point) => ({
      ...point,
      payload: {
        ...point.payload,
        project_public_id: projectPublicId,
      },
    }));

    await this.client.upsert(AI_COLLECTION_NAME, {
      wait: true,
      points: pointsWithProject,
    });
  }
}
