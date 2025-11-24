import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';
import { SearchQueryDto } from './dto/search-query.dto';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'dms_documents';

  constructor(
    private readonly esService: ElasticsearchService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
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
          } as any,
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
  async indexDocument(doc: any) {
    try {
      return await this.esService.index({
        index: this.indexName,
        id: `${doc.type}_${doc.id}`, // Unique ID: rfa_101
        document: doc, // ✅ Library รุ่นใหม่ใช้ 'document' แทน 'body' ในบางเวอร์ชัน
      });
    } catch (error) {
      this.logger.error(
        `Failed to index document: ${(error as Error).message}`,
      );
    }
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
        `Failed to remove document: ${(error as Error).message}`,
      );
    }
  }

  /**
   * ค้นหาเอกสาร (Full-text Search)
   */
  async search(queryDto: SearchQueryDto) {
    const { q, type, projectId, page = 1, limit = 20 } = queryDto;
    const from = (page - 1) * limit;

    const mustQueries: any[] = [];

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
    const filterQueries: any[] = [];
    if (type) filterQueries.push({ term: { type } });
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
        sort: [{ createdAt: { order: 'desc' } }],
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
      this.logger.error(`Search failed: ${(error as Error).message}`);
      return { data: [], meta: { total: 0, page, limit, took: 0 } };
    }
  }
}
