// File: backend/src/modules/search/search.service.ts
// Change Log:
// - 2026-09-23: (1) indexDocument resolve RFA subtype จากตาราง rfas — แก้ drift
//   'correspondence_<uuid>' vs 'rfa_<uuid>' duplicate key, (2) removeDocument
//   เปลี่ยนเป็นรับ publicId ลบทั้งสอง prefix (แก้ bug ใช้ int id + ไม่มี caller),
//   (3) เพิ่ม reconcileIndex() cron hourly — add missing / delete stale /
//   update drifted docs
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchQueryDto } from './dto/search-query.dto';
import { Correspondence } from '../correspondence/entities/correspondence.entity';
import { Rfa } from '../rfa/entities/rfa.entity';

/** ขนาดสูงสุดของ result window ตอน reconcile — เพียงพอกับจำนวนเอกสารทั้งระบบ */
const RECONCILE_FETCH_SIZE = 10_000;

/** รูปแบบ doc ที่ index เข้า Elasticsearch */
type SearchIndexDoc = Record<string, unknown> & {
  type: string;
  id?: number;
  publicId?: string;
};

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
   * หมายเหตุ: caller ทุกจุดส่ง type='correspondence' เสมอแม้เอกสารจะเป็น RFA —
   * resolve subtype จริงจากตาราง rfas (shared PK) เพื่อให้ ES doc id ตรงกับ
   * reindexAll() เสมอ ไม่เกิด duplicate key 'correspondence_<uuid>' กับ 'rfa_<uuid>'
   */
  async indexDocument(doc: SearchIndexDoc) {
    try {
      const resolvedType = await this.resolveDocumentType(doc);
      const resolvedDoc = { ...doc, type: resolvedType };
      return await this.esService.index({
        index: this.indexName,
        id: doc.publicId
          ? `${resolvedType}_${doc.publicId}`
          : `${resolvedType}_${doc.id}`, // ADR-019: prefer publicId key
        document: resolvedDoc, // ✅ Library รุ่นใหม่ใช้ 'document' แทน 'body' ในบางเวอร์ชัน
      });
    } catch (error) {
      this.logger.error(
        `Failed to index document: ${(error as Error).message}`
      );
    }
  }

  /**
   * Resolve doc type จริง — RFA เป็น CTI subtype ของ correspondences (shared PK)
   * caller ที่ส่ง 'correspondence' มาแต่ id อยู่ใน rfas จะถูก normalize เป็น 'rfa'
   */
  private async resolveDocumentType(doc: {
    type: string;
    id?: number;
  }): Promise<string> {
    if (doc.type !== 'correspondence' || doc.id == null) {
      return doc.type;
    }
    try {
      const isRfa = await this.rfaRepo.existsBy({ id: doc.id });
      return isRfa ? 'rfa' : 'correspondence';
    } catch (err) {
      this.logger.warn(
        `Failed to resolve RFA subtype for id=${doc.id}: ${(err as Error).message} — indexing as correspondence`
      );
      return 'correspondence';
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

    const expected = await this.buildExpectedDocs();

    let indexed = 0;
    let failed = 0;
    for (const doc of expected.values()) {
      const docType = doc.type;
      if (typeFilter && typeFilter !== docType) continue;

      // indexDocument() ไม่ throw เอง (catch + log ภายในแล้ว return undefined เมื่อ error)
      // จึงต้องเช็คจาก return value แทน try/catch เพื่อนับ failed ให้ถูกต้อง
      const result = await this.indexDocument(doc);
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
   * สร้าง map ของเอกสารที่ควรอยู่ใน index จาก DB — key = `${type}_${publicId}`
   * ใช้ร่วมกันระหว่าง reindexAll() และ reconcileIndex()
   */
  private async buildExpectedDocs(): Promise<Map<string, SearchIndexDoc>> {
    const [correspondences, rfaRows] = await Promise.all([
      this.correspondenceRepo.find({
        relations: ['revisions', 'revisions.status'],
      }),
      this.rfaRepo.find({ select: ['id'] }),
    ]);
    const rfaIds = new Set(rfaRows.map((r) => r.id));

    const expected = new Map<string, SearchIndexDoc>();
    for (const corr of correspondences) {
      const docType = rfaIds.has(corr.id) ? 'rfa' : 'correspondence';
      const currentRevision =
        corr.revisions?.find((r) => r.isCurrent) ?? corr.revisions?.[0];
      const doc: SearchIndexDoc = {
        id: corr.id,
        publicId: corr.publicId,
        type: docType,
        docNumber: corr.correspondenceNumber,
        title: currentRevision?.subject ?? corr.correspondenceNumber,
        status: currentRevision?.status?.statusCode ?? 'UNKNOWN',
        projectId: corr.projectId,
        createdAt: corr.createdAt,
      };
      expected.set(`${docType}_${corr.publicId}`, doc);
    }
    return expected;
  }

  /**
   * Periodic reconcile ระหว่าง Elasticsearch index กับ DB (ทุกชั่วโมง)
   * ซ่อม drift ทุกชนิด: เอกสารที่หายไปจาก index, stale docs ที่ถูกลบจาก DB แล้ว,
   * และ field drift (docNumber/title/status/type) — รวมถึงการแก้ข้อมูลตรง DB
   * ที่ bypass application layer ทั้งหมด
   */
  @Cron(CronExpression.EVERY_HOUR)
  async reconcileIndex(): Promise<{
    added: number;
    updated: number;
    deleted: number;
    unchanged: number;
  }> {
    const empty = { added: 0, updated: 0, deleted: 0, unchanged: 0 };
    if (!this.isElasticsearchAvailable) {
      return empty;
    }

    try {
      const [expected, esDocs] = await Promise.all([
        this.buildExpectedDocs(),
        this.fetchAllIndexedDocs(),
      ]);

      let added = 0;
      let updated = 0;
      let deleted = 0;
      let unchanged = 0;

      // ลบ stale docs ที่ไม่มีใน DB แล้ว (รวมถึง key prefix ผิด เช่น
      // correspondence_<uuid> ของ RFA ที่ถูก index ก่อนมี subtype resolution)
      for (const esId of esDocs.keys()) {
        if (!expected.has(esId)) {
          await this.deleteIndexKey(esId);
          deleted++;
        }
      }

      // index เอกสารที่หายไป หรือ field drift
      for (const [key, doc] of expected) {
        const existing = esDocs.get(key);
        if (!existing) {
          const result = await this.indexDocument(doc);
          if (result) added++;
          continue;
        }
        if (this.isDocDrifted(existing, doc)) {
          const result = await this.indexDocument(doc);
          if (result) updated++;
          continue;
        }
        unchanged++;
      }

      if (added + updated + deleted > 0) {
        this.logger.log(
          `Index reconcile: added=${added} updated=${updated} deleted=${deleted} unchanged=${unchanged}`
        );
      }
      return { added, updated, deleted, unchanged };
    } catch (err) {
      this.logger.error(
        `Index reconcile failed: ${(err as Error).message}`,
        (err as Error).stack
      );
      return empty;
    }
  }

  /**
   * ดึงเอกสารทั้งหมดใน index พร้อม _source — ใช้เทียบกับ DB ตอน reconcile
   */
  private async fetchAllIndexedDocs(): Promise<
    Map<string, Record<string, unknown>>
  > {
    const result = await this.esService.search<Record<string, unknown>>({
      index: this.indexName,
      size: RECONCILE_FETCH_SIZE,
      _source: true,
      query: { match_all: {} },
    });
    const map = new Map<string, Record<string, unknown>>();
    for (const hit of result.hits.hits) {
      if (hit._id && hit._source) {
        map.set(hit._id, hit._source);
      }
    }
    return map;
  }

  /** เปรียบเทียบ field ที่ index ไว้ — true = ต้อง re-index */
  private isDocDrifted(
    existing: Record<string, unknown>,
    expected: Record<string, unknown>
  ): boolean {
    return (
      existing.docNumber !== expected.docNumber ||
      existing.title !== expected.title ||
      existing.status !== expected.status ||
      existing.type !== expected.type
    );
  }

  /**
   * ลบเอกสารออกจาก Index ด้วย publicId — ลบทั้ง key 'correspondence_<publicId>'
   * และ 'rfa_<publicId>' เพื่อครอบคลุม docs ที่เคยถูก index ด้วย prefix ผิด
   * (bug เดิม: caller ส่ง type='correspondence' เสมอแม้เป็น RFA)
   */
  async removeDocument(publicId: string): Promise<void> {
    await Promise.all([
      this.deleteIndexKey(`correspondence_${publicId}`),
      this.deleteIndexKey(`rfa_${publicId}`),
    ]);
  }

  /** ลบ doc ตาม ES key — 404 ถือว่าสำเร็จ (idempotent) */
  private async deleteIndexKey(key: string): Promise<void> {
    try {
      await this.esService.delete({
        index: this.indexName,
        id: key,
      });
    } catch (error) {
      const err = error as Error & { meta?: { statusCode?: number } };
      if (err.meta?.statusCode === 404) {
        return; // ไม่มี doc อยู่แล้ว — ไม่ใช่ error
      }
      this.logger.error(`Failed to remove document ${key}: ${err.message}`);
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
