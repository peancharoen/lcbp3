import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorMetadata extends Record<string, unknown> {
  chunk_id: string;
  public_id: string;
  project_public_id: string;
  doc_type: string;
  doc_number: string | null;
  revision: string | null;
  project_code: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  content_preview: string;
  embedding_model: string;
}

export interface HybridSearchResult {
  chunkId: string;
  publicId: string;
  docType: string;
  docNumber: string | null;
  revision: string | null;
  projectCode: string;
  contentPreview: string;
  score: number;
}

const COLLECTION_NAME = 'lcbp3_vectors';
const VECTOR_SIZE = 768;

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;
  private collectionReady = false;

  constructor(private readonly configService: ConfigService) {
    const url = this.configService.get<string>(
      'QDRANT_URL',
      'http://localhost:6333'
    );
    this.client = new QdrantClient({ url });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.initCollection();
      this.collectionReady = true;
      this.logger.log(`Qdrant collection '${COLLECTION_NAME}' ready`);
    } catch (err) {
      this.logger.error(
        'Qdrant collection init failed — RAG queries will return 503',
        err instanceof Error ? err.stack : String(err)
      );
      this.collectionReady = false;
    }
  }

  isReady(): boolean {
    return this.collectionReady;
  }

  private async initCollection(): Promise<void> {
    const collections = await this.client.getCollections();
    const exists = collections.collections.some(
      (c) => c.name === COLLECTION_NAME
    );

    if (!exists) {
      await this.client.createCollection(COLLECTION_NAME, {
        vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
        hnsw_config: {
          payload_m: 16,
          m: 0,
        },
        optimizers_config: { indexing_threshold: 10000 },
      });
      this.logger.log(`Created Qdrant collection '${COLLECTION_NAME}'`);

      await this.client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'project_public_id',
        field_schema: { type: 'keyword', is_tenant: true } as Parameters<
          QdrantClient['createPayloadIndex']
        >[1]['field_schema'],
      });
      await this.client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'classification',
        field_schema: 'keyword',
      });
      await this.client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'doc_type',
        field_schema: 'keyword',
      });
      await this.client.createPayloadIndex(COLLECTION_NAME, {
        field_name: 'doc_number',
        field_schema: 'keyword',
      });
    }
  }

  async upsertBatch(
    points: Array<{ id: string; vector: number[]; payload: VectorMetadata }>
  ): Promise<void> {
    await this.client.upsert(COLLECTION_NAME, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: p.payload,
      })),
    });
  }

  async hybridSearch(
    queryVector: number[],

    projectPublicId: string,
    classificationCeiling: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL',
    topK: number
  ): Promise<HybridSearchResult[]> {
    const classificationValues = this.getAllowedClassifications(
      classificationCeiling
    );

    const vectorResults = await this.client.search(COLLECTION_NAME, {
      vector: queryVector,
      limit: topK,
      filter: {
        must: [
          { key: 'project_public_id', match: { value: projectPublicId } },
          { key: 'classification', match: { any: classificationValues } },
        ],
      },
      with_payload: true,
    });

    return vectorResults.map((r) => {
      const payload = r.payload as unknown as VectorMetadata;
      return {
        chunkId: payload.chunk_id,
        publicId: payload.public_id,
        docType: payload.doc_type,
        docNumber: payload.doc_number,
        revision: payload.revision,
        projectCode: payload.project_code,
        contentPreview: payload.content_preview,
        score: r.score,
      };
    });
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.client.delete(COLLECTION_NAME, {
      wait: true,
      filter: {
        must: [{ key: 'public_id', match: { value: documentId } }],
      },
    });
  }

  async forceInitCollection(): Promise<void> {
    await this.initCollection();
    this.collectionReady = true;
    this.logger.log(`Qdrant collection force-initialized`);
  }

  private getAllowedClassifications(
    ceiling: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'
  ): string[] {
    const order: Array<'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL'> = [
      'PUBLIC',
      'INTERNAL',
      'CONFIDENTIAL',
    ];
    const ceilIdx = order.indexOf(ceiling);
    return order.slice(0, ceilIdx + 1);
  }
}
