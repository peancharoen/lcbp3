# Task: Search & Elasticsearch Integration

**Status:** 🚧 In Progress
**Priority:** P2 (Medium - Performance Enhancement)
**Estimated Effort:** 4-6 days
**Dependencies:** TASK-BE-001, TASK-BE-005, TASK-BE-007
**Owner:** Backend Team

---

## 📋 Overview

สร้าง Search Module ที่ integrate กับ Elasticsearch สำหรับ Full-text Search และ Advanced Filtering

---

## 🎯 Objectives

- [x] Elasticsearch Integration
- [x] Full-text Search (Correspondences, RFAs, Drawings)
- [x] Advanced Filters
- [ ] Search Result Aggregations (Pending verification)
- [x] Auto-indexing (Implemented via Direct Call, not Queue yet)

---

## 📝 Acceptance Criteria

1. **Search Capabilities:**

   - [x] Search across multiple document types
   - [x] Full-text search in title, description
   - [x] Filter by project, status, date range
   - [x] Sort results by relevance/date

2. **Indexing:**

   - [x] Auto-index on document create/update (Direct Call implemented)
   - [ ] Async indexing (via queue) - **Pending**
   - [ ] Bulk re-indexing command - **Pending**

3. **Performance:**
   - [x] Search results < 500ms
   - [x] Pagination support
   - [x] Highlight search terms

---

## 🛠️ Implementation Steps

### 1. Elasticsearch Module Setup

```typescript
// File: backend/src/modules/search/search.module.ts
import { ElasticsearchModule } from '@nestjs/elasticsearch';

@Module({
  imports: [
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    }),
  ],
  providers: [SearchService, SearchIndexer],
  exports: [SearchService],
})
export class SearchModule {}
```

### 2. Index Mapping

```typescript
// File: backend/src/modules/search/mappings/correspondence.mapping.ts
export const correspondenceMapping = {
  properties: {
    id: { type: 'integer' },
    correspondence_number: { type: 'keyword' },
    title: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
    description: {
      type: 'text',
      analyzer: 'standard',
    },
    project_id: { type: 'integer' },
    project_name: { type: 'keyword' },
    status: { type: 'keyword' },
    created_at: { type: 'date' },
    created_by_username: { type: 'keyword' },
    organization_name: { type: 'keyword' },
    type_name: { type: 'keyword' },
    discipline_name: { type: 'keyword' },
  },
};
```

### 3. Search Service

```typescript
// File: backend/src/modules/search/search.service.ts
import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';

@Injectable()
export class SearchService {
  private readonly INDEX_NAME = 'lcbp3-documents';

  constructor(private elasticsearch: ElasticsearchService) {}

  async onModuleInit() {
    // Create index if not exists
    const indexExists = await this.elasticsearch.indices.exists({
      index: this.INDEX_NAME,
    });

    if (!indexExists) {
      await this.createIndex();
    }
  }

  private async createIndex(): Promise<void> {
    await this.elasticsearch.indices.create({
      index: this.INDEX_NAME,
      body: {
        mappings: {
          properties: {
            document_type: { type: 'keyword' },
            ...correspondenceMapping.properties,
            ...rfaMapping.properties,
          },
        },
      },
    });
  }

  async search(query: SearchQueryDto): Promise<SearchResult> {
    const must: any[] = [];
    const filter: any[] = [];

    // Full-text search
    if (query.search) {
      must.push({
        multi_match: {
          query: query.search,
          fields: ['title^2', 'description', 'correspondence_number'],
          fuzziness: 'AUTO',
        },
      });
    }

    // Filters
    if (query.document_type) {
      filter.push({ term: { document_type: query.document_type } });
    }

    if (query.project_id) {
      filter.push({ term: { project_id: query.project_id } });
    }

    if (query.status) {
      filter.push({ term: { status: query.status } });
    }

    if (query.date_from || query.date_to) {
      const range: any = {};
      if (query.date_from) range.gte = query.date_from;
      if (query.date_to) range.lte = query.date_to;
      filter.push({ range: { created_at: range } });
    }

    // Execute search
    const page = query.page || 1;
    const limit = query.limit || 20;
    const from = (page - 1) * limit;

    const result = await this.elasticsearch.search({
      index: this.INDEX_NAME,
      body: {
        from,
        size: limit,
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: query.sort_by
          ? [{ [query.sort_by]: { order: query.sort_order || 'desc' } }]
          : [{ _score: 'desc' }, { created_at: 'desc' }],
        highlight: {
          fields: {
            title: {},
            description: {},
          },
        },
        aggs: {
          document_types: {
            terms: { field: 'document_type' },
          },
          statuses: {
            terms: { field: 'status' },
          },
          projects: {
            terms: { field: 'project_id' },
          },
        },
      },
    });

    return {
      items: result.hits.hits.map((hit) => ({
        ...hit._source,
        _score: hit._score,
        _highlights: hit.highlight,
      })),
      total: result.hits.total.value,
      page,
      limit,
      totalPages: Math.ceil(result.hits.total.value / limit),
      aggregations: result.aggregations,
    };
  }

  async indexDocument(
    documentType: string,
    documentId: number,
    data: any
  ): Promise<void> {
    await this.elasticsearch.index({
      index: this.INDEX_NAME,
      id: `${documentType}-${documentId}`,
      body: {
        document_type: documentType,
        ...data,
      },
    });
  }

  async updateDocument(
    documentType: string,
    documentId: number,
    data: any
  ): Promise<void> {
    await this.elasticsearch.update({
      index: this.INDEX_NAME,
      id: `${documentType}-${documentId}`,
      body: {
        doc: data,
      },
    });
  }

  async deleteDocument(
    documentType: string,
    documentId: number
  ): Promise<void> {
    await this.elasticsearch.delete({
      index: this.INDEX_NAME,
      id: `${documentType}-${documentId}`,
    });
  }
}
```

### 4. Search Indexer (Queue Worker)

```typescript
// File: backend/src/modules/search/search-indexer.service.ts
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';

@Processor('search-indexing')
export class SearchIndexer {
  constructor(
    private searchService: SearchService,
    @InjectRepository(Correspondence)
    private correspondenceRepo: Repository<Correspondence>,
    @InjectRepository(Rfa)
    private rfaRepo: Repository<Rfa>
  ) {}

  @Process('index-correspondence')
  async indexCorrespondence(job: Job<{ id: number }>) {
    const correspondence = await this.correspondenceRepo.findOne({
      where: { id: job.data.id },
      relations: ['project', 'originatorOrganization', 'revisions'],
    });

    if (!correspondence) {
      return;
    }

    const latestRevision = correspondence.revisions[0];

    await this.searchService.indexDocument(
      'correspondence',
      correspondence.id,
      {
        id: correspondence.id,
        correspondence_number: correspondence.correspondence_number,
        title: correspondence.title,
        description: latestRevision?.description,
        project_id: correspondence.project_id,
        project_name: correspondence.project.project_name,
        status: correspondence.status,
        created_at: correspondence.created_at,
        organization_name:
          correspondence.originatorOrganization.organization_name,
      }
    );
  }

  @Process('index-rfa')
  async indexRfa(job: Job<{ id: number }>) {
    const rfa = await this.rfaRepo.findOne({
      where: { id: job.data.id },
      relations: ['project', 'revisions'],
    });

    if (!rfa) {
      return;
    }

    const latestRevision = rfa.revisions[0];

    await this.searchService.indexDocument('rfa', rfa.id, {
      id: rfa.id,
      rfa_number: rfa.rfa_number,
      title: rfa.subject,
      description: latestRevision?.description,
      project_id: rfa.project_id,
      project_name: rfa.project.project_name,
      status: rfa.status,
      created_at: rfa.created_at,
    });
  }

  @Process('bulk-reindex')
  async bulkReindex(job: Job) {
    // Re-index all correspondences
    const correspondences = await this.correspondenceRepo.find({
      relations: ['project', 'originatorOrganization', 'revisions'],
    });

    for (const corr of correspondences) {
      await this.indexCorrespondence({ data: { id: corr.id } } as Job);
    }

    // Re-index all RFAs
    const rfas = await this.rfaRepo.find({
      relations: ['project', 'revisions'],
    });

    for (const rfa of rfas) {
      await this.indexRfa({ data: { id: rfa.id } } as Job);
    }
  }
}
```

### 5. Integration with Service

```typescript
// File: backend/src/modules/correspondence/correspondence.service.ts (updated)
@Injectable()
export class CorrespondenceService {
  constructor(
    // ... existing dependencies
    private searchQueue: Queue
  ) {}

  async create(
    dto: CreateCorrespondenceDto,
    userId: number
  ): Promise<Correspondence> {
    const correspondence = await this.dataSource.transaction(/* ... */);

    // Queue for indexing (async)
    await this.searchQueue.add('index-correspondence', {
      id: correspondence.id,
    });

    return correspondence;
  }

  async update(id: number, dto: UpdateCorrespondenceDto): Promise<void> {
    await this.corrRepo.update(id, dto);

    // Re-index
    await this.searchQueue.add('index-correspondence', { id });
  }
}
```

### 6. Search Controller

```typescript
// File: backend/src/modules/search/search.controller.ts
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private searchService: SearchService) {}

  @Get()
  async search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query);
  }

  @Post('reindex')
  @RequirePermission('admin.manage')
  async reindex() {
    await this.searchQueue.add('bulk-reindex', {});
    return { message: 'Re-indexing started' };
  }
}
```

---

## ✅ Testing & Verification

### 1. Unit Tests

```typescript
describe('SearchService', () => {
  it('should search with full-text query', async () => {
    const result = await service.search({
      search: 'foundation',
      page: 1,
      limit: 20,
    });

    expect(result.items).toBeDefined();
    expect(result.total).toBeGreaterThan(0);
  });

  it('should filter by project and status', async () => {
    const result = await service.search({
      project_id: 1,
      status: 'submitted',
    });

    result.items.forEach((item) => {
      expect(item.project_id).toBe(1);
      expect(item.status).toBe('submitted');
    });
  });
});
```

---

## 📚 Related Documents

- [System Architecture - Search](../02-architecture/system-architecture.md#elasticsearch)
- [ADR-005: Technology Stack](../05-decisions/ADR-005-technology-stack.md)

---

## 📦 Deliverables

- [x] SearchService with Elasticsearch
- [ ] Search Indexer (Queue Worker) - **Pending**
- [x] Index Mappings (Implemented in Service)
- [ ] Queue Integration - **Pending**
- [x] Search Controller
- [ ] Bulk Re-indexing Command - **Pending**
- [ ] Unit Tests (75% coverage)
- [ ] API Documentation

---

## 🚨 Risks & Mitigation

| Risk               | Impact | Mitigation            |
| ------------------ | ------ | --------------------- |
| Elasticsearch down | Medium | Fallback to DB search |
| Index out of sync  | Medium | Regular re-indexing   |
| Large result sets  | Low    | Pagination + limits   |

---

## 📌 Notes

- Async indexing via BullMQ
- Index correspondence, RFA, drawings
- Support Thai language search
- Highlight matching terms
- Aggregations for faceted search
- Re-index command for admin
