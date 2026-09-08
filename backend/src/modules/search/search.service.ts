import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchQueryDto } from './dto/search-query.dto';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { Rfa } from '../rfa/entities/rfa.entity';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'dms_documents';
  private isElasticsearchAvailable = false;

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly configService: ConfigService,
    @InjectRepository(Correspondence)
    private readonly correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(Rfa)
    private readonly rfaRepo: Repository<Rfa>
  ) {}

  async onModuleInit() {
    // Test Elasticsearch connection first
    try {
      await this.esService.ping();
      this.logger.log('Elasticsearch connection successful');
      this.isElasticsearchAvailable = true;
    } catch (error) {
      this.logger.error(
        `Elasticsearch connection failed: ${(error as Error).message}`,
        (error as Error).stack
      );
      this.isElasticsearchAvailable = false;
      return; // Don't try to create index if connection fails
    }

    await this.createIndexIfNotExists();
  }

  /**
   * สร้าง Index และกำหนด Mapping (Schema)
   */
  private async createIndexIfNotExists() {
    try {
      const indexExists = await this.esService.indices.exists({
        index: this.indexName,
      });

      if (!indexExists) {
        // ✅ FIX: Cast 'body' เป็น any เพื่อแก้ปัญหา Type Mismatch ของ Library
        await this.esService.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                id: { type: 'integer' },
                uuid: { type: 'keyword' }, // ADR-019: public identifier
                type: { type: 'keyword' }, // correspondence, rfa, drawing
                docNumber: { type: 'text' },
                title: { type: 'text', analyzer: 'standard' },
                description: { type: 'text', analyzer: 'standard' },
                status: { type: 'keyword' },
                projectId: { type: 'integer' },
                createdAt: { type: 'date' },
                tags: { type: 'text' },
              },
            },
          } as unknown as Record<string, unknown>,
        });
        this.logger.log(`Elasticsearch index '${this.indexName}' created.`);
      }
    } catch (error) {
      this.logger.error(`Failed to create index: ${(error as Error).message}`);
    }
  }

  /**
   * Index เอกสาร (Create/Update)
   */
  async indexDocument(
    doc: Record<string, unknown> & {
      type: string;
      id?: number;
      publicId?: string;
    }
  ) {
    try {
      return await this.esService.index({
        index: this.indexName,
        id: doc.publicId
          ? `${doc.type}_${doc.publicId}`
          : `${doc.type}_${doc.id}`, // ADR-019: prefer publicId key
        document: doc, // ✅ Library รุ่นใหม่ใช้ 'document' แทน 'body' ในบางเวอร์ชัน
      });
    } catch (error) {
      this.logger.error(
        `Failed to index document: ${(error as Error).message}`
      );
    }
  }

  /**
   * Backfill index ทั้งหมดจาก DB (Admin only) — ใช้แก้กรณี index ว่าง/ไม่ตรงกับ DB
   * เช่น เอกสารที่เข้าระบบผ่าน migration commit ก่อนที่จะมีการ wire indexDocument()
   * เข้า path นั้น (bugfix 2026-09-08) — ครอบคลุมทั้ง correspondence และ rfa
   * (RFA เป็น CTI subtype ของ correspondences ตาราง id เดียวกัน)
   */
  async reindexAll(
    typeFilter?: string
  ): Promise<{ indexed: number; failed: number }> {
    if (!this.isElasticsearchAvailable) {
      this.logger.warn('Reindex skipped — Elasticsearch not connected');
      return { indexed: 0, failed: 0 };
    }

    const [correspondences, rfaRows] = await Promise.all([
      this.correspondenceRepo.find({
        relations: ['revisions', 'revisions.status'],
      }),
      this.rfaRepo.find({ select: ['id'] }),
    ]);
    const rfaIds = new Set(rfaRows.map((r) => r.id));

    let indexed = 0;
    let failed = 0;
    for (const corr of correspondences) {
      const docType = rfaIds.has(corr.id) ? 'rfa' : 'correspondence';
      if (typeFilter && typeFilter !== docType) continue;

      const currentRevision =
        corr.revisions?.find((r) => r.isCurrent) ?? corr.revisions?.[0];
      // indexDocument() ไม่ throw เอง (catch + log ภายในแล้ว return undefined เมื่อ error)
      // จึงต้องเช็คจาก return value แทน try/catch เพื่อนับ failed ให้ถูกต้อง
      const result = await this.indexDocument({
        id: corr.id,
        publicId: corr.publicId,
        type: docType,
        docNumber: corr.correspondenceNumber,
        title: currentRevision?.subject ?? corr.correspondenceNumber,
        status: currentRevision?.status?.statusCode ?? 'UNKNOWN',
        projectId: corr.projectId,
        createdAt: corr.createdAt,
      });
      if (result) {
        indexed++;
      } else {
        failed++;
      }
    }

    this.logger.log(`Reindex complete: ${indexed} indexed, ${failed} failed`);
    return { indexed, failed };
  }

  /**
   * ลบเอกสารออกจาก Index
   */
  async removeDocument(type: string, id: number) {
    try {
      await this.esService.delete({
        index: this.indexName,
        id: `${type}_${id}`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to remove document: ${(error as Error).message}`
      );
    }
  }

  /**
   * ค้นหาเอกสาร (Full-text Search)
   */
  async search(queryDto: SearchQueryDto) {
    const { q, type, status, projectId, page = 1, limit = 20 } = queryDto;
    const from = (page - 1) * limit;

    // Early fallback if Elasticsearch is not available
    if (!this.isElasticsearchAvailable) {
      this.logger.warn('Search unavailable - Elasticsearch not connected');
      return { data: [], meta: { total: 0, page, limit, took: 0 } };
    }

    const mustQueries: Record<string, unknown>[] = [];

    // 1. Full-text search logic
    if (q) {
      mustQueries.push({
        multi_match: {
          query: q,
          fields: ['title^3', 'docNumber^2', 'description', 'tags'], // Boost ความสำคัญ
          fuzziness: 'AUTO',
        },
      });
    } else {
      mustQueries.push({ match_all: {} });
    }

    // 2. Filter logic
    const filterQueries: Record<string, unknown>[] = [];
    if (type) filterQueries.push({ term: { type } });
    if (status) filterQueries.push({ term: { status } });
    if (projectId) filterQueries.push({ term: { projectId } });

    try {
      const result = await this.esService.search({
        index: this.indexName,
        from,
        size: limit,
        // ✅ ส่ง Query Structure โดยตรง
        query: {
          bool: {
            must: mustQueries,
            filter: filterQueries,
          },
        },
        sort: [{ createdAt: { order: 'desc' as const } }],
      });

      // 3. Format Result
      const hits = result.hits.hits;
      const total =
        typeof result.hits.total === 'number'
          ? result.hits.total
          : result.hits.total?.value || 0;

      return {
        data: hits.map((hit) => hit._source),
        meta: {
          total,
          page,
          limit,
          took: result.took,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Search failed: ${err.message}`, err.stack);
      this.logger.debug(
        `Search query context: ${JSON.stringify({
          query: queryDto,
          esNode: String(this.configService.get('ELASTICSEARCH_NODE') ?? ''),
        })}`
      );
      return { data: [], meta: { total: 0, page, limit, took: 0 } };
    }
  }
}
