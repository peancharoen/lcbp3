# Task BE-API-01: API Design Strategy Implementation

**Phase:** Backend API Standardization
**ADR Compliance:** ADR-003 (API Design Strategy), ADR-019 (UUID Strategy)
**Priority:** 🟡 Important - API Consistency & Developer Experience

> **Context:** การ implement Hybrid REST + Action Endpoints ตาม ADR-003 เพื่อให้ API สอดคล้องกันทั่วทั้งระบบ

---

## 📋 Implementation Tasks

### **API-1.1: Base Controller & Patterns**
- [ ] **Create Base Controller Class:**
  - File: `backend/src/common/controllers/base.controller.ts`
  - Features: Standard CRUD operations, pagination, filtering
  - Methods: `findAll()`, `findOne(uuid)`, `create()`, `update(uuid)`, `remove(uuid)`
- [ ] **Create Standard Response DTOs:**
  - File: `backend/src/common/dto/response.dto.ts`
  - Types: `ApiResponse<T>`, `PaginatedResponse<T>`, `ActionResponse`
  - Include meta information: timestamp, pagination, version
- [ ] **Create Action Endpoint Decorator:**
  - File: `backend/src/common/decorators/action-endpoint.decorator.ts`
  - Purpose: Mark business action endpoints for Swagger documentation
  - Usage: `@ActionEndpoint('submit', 'Submit correspondence for routing')`

### **API-1.2: Correspondence API Refactor**
- [ ] **Update Correspondence Controller:**
  - File: `backend/src/modules/correspondence/correspondence.controller.ts`
  - REST endpoints: GET, POST, PUT, PATCH, DELETE `/correspondences`
  - Action endpoints: 
    - POST `/correspondences/:uuid/submit`
    - POST `/correspondences/:uuid/approve`
    - POST `/correspondences/:uuid/reject`
    - POST `/correspondences/:uuid/forward`
- [ ] **Create Action DTOs:**
  - File: `backend/src/modules/correspondence/dto/correspondence-actions.dto.ts`
  - DTOs: `SubmitDto`, `ApproveDto`, `RejectDto`, `ForwardDto`
  - Validation: Business rules for each action
- [ ] **Update Correspondence Service:**
  - Methods: `submit()`, `approve()`, `reject()`, `forward()`
  - Integration: Workflow engine transitions
  - Error handling: Business exceptions for invalid states

### **API-1.3: RFA API Implementation**
- [ ] **Create RFA Controller:**
  - File: `backend/src/modules/rfa/rfa.controller.ts`
  - REST endpoints: Standard CRUD for RFAs
  - Action endpoints:
    - POST `/rfa/:uuid/submit-for-review`
    - POST `/rfa/:uuid/approve`
    - POST `/rfa/:uuid/request-changes`
    - POST `/rfa/:uuid/final-approve`
- [ ] **Create RFA Action DTOs:**
  - File: `backend/src/modules/rfa/dto/rfa-actions.dto.ts`
  - DTOs: `SubmitForReviewDto`, `ApproveDto`, `RequestChangesDto`
  - Include: Comments, attachments, change requests
- [ ] **Update RFA Service:**
  - Workflow integration: Document numbering, state transitions
  - Business logic: Review cycles, approval chains
  - Notifications: Trigger email/LINE notifications

### **API-1.4: API Documentation & Testing**
- [ ] **Update Swagger Configuration:**
  - File: `backend/src/main.ts`
  - Group endpoints by module and type (REST vs Actions)
  - Add examples for all DTOs and responses
  - Configure security: JWT Bearer authentication
- [ ] **Create API Client Library:**
  - File: `frontend/lib/api/client.ts`
  - Methods: Typed API calls for all endpoints
  - Error handling: Parse structured error responses
  - Type safety: TypeScript interfaces for all DTOs
- [ ] **Add Integration Tests:**
  - Directory: `backend/test/api/`
  - Coverage: All REST and action endpoints
  - Scenarios: Success cases, error cases, permission tests
  - Tools: Jest, Supertest

### **API-1.5: Performance & Optimization**
- [ ] **Implement Response Caching:**
  - Master data endpoints: Organizations, projects, types
  - Cache keys: `master:${entity}:${projectId}`
  - TTL: 1 hour for master data, 15 minutes for dynamic data
- [ ] **Add Request Validation:**
  - DTO validation: class-validator decorators
  - Business rule validation: Custom validators
  - Rate limiting: By user role and endpoint type
- [ ] **Database Query Optimization:**
  - Pagination: Limit/offset with total count
  - Filtering: Dynamic where clauses
  - Relations: Eager loading for common queries

---

## 🔧 Technical Implementation Details

### Base Controller Structure

```typescript
// File: backend/src/common/controllers/base.controller.ts
export abstract class BaseController<T extends BaseEntity> {
  constructor(
    protected readonly service: BaseService<T>,
    protected readonly entityName: string
  ) {}

  @Get()
  @ApiResponse({ status: 200, description: `List ${entityName}` })
  async findAll(@Query() query: PaginationDto): Promise<PaginatedResponse<T>> {
    return this.service.findAll(query);
  }

  @Get(':uuid')
  @ApiResponse({ status: 200, description: `Get ${entityName} by UUID` })
  async findOne(@Param('uuid') uuid: string): Promise<ApiResponse<T>> {
    return this.service.findOne(uuid);
  }

  @Post()
  @ApiResponse({ status: 201, description: `Create ${entityName}` })
  async create(@Body() dto: CreateDto): Promise<ApiResponse<T>> {
    return this.service.create(dto);
  }

  // ... other standard methods
}
```

### Action Endpoint Pattern

```typescript
// File: backend/src/modules/correspondence/correspondence.controller.ts
@Controller('correspondences')
@ApiTags('Correspondences')
export class CorrespondenceController extends BaseController<Correspondence> {
  
  @Post(':uuid/submit')
  @ActionEndpoint('submit', 'Submit correspondence for routing')
  @ApiResponse({ status: 200, description: 'Correspondence submitted successfully' })
  async submit(
    @Param('uuid') uuid: string,
    @Body() dto: SubmitCorrespondenceDto,
    @CurrentUser() user: User
  ): Promise<ActionResponse> {
    return this.correspondenceService.submit(uuid, dto, user.id);
  }

  @Post(':uuid/approve')
  @ActionEndpoint('approve', 'Approve correspondence')
  async approve(
    @Param('uuid') uuid: string,
    @Body() dto: ApproveCorrespondenceDto,
    @CurrentUser() user: User
  ): Promise<ActionResponse> {
    return this.correspondenceService.approve(uuid, dto, user.id);
  }
}
```

### Frontend API Client

```typescript
// File: frontend/lib/api/correspondence.ts
export class CorrespondenceApi {
  private client = new ApiClient('/correspondences');

  // REST operations
  async findAll(query?: CorrespondenceListQuery): Promise<PaginatedCorrespondences> {
    return this.client.get('', { params: query });
  }

  async findOne(uuid: string): Promise<Correspondence> {
    return this.client.get(`/${uuid}`);
  }

  async create(dto: CreateCorrespondenceDto): Promise<Correspondence> {
    return this.client.post('', dto);
  }

  // Action operations
  async submit(uuid: string, dto: SubmitCorrespondenceDto): Promise<ActionResponse> {
    return this.client.post(`/${uuid}/submit`, dto);
  }

  async approve(uuid: string, dto: ApproveCorrespondenceDto): Promise<ActionResponse> {
    return this.client.post(`/${uuid}/approve`, dto);
  }
}
```

---

## 📊 Success Criteria

### Functional Requirements
- [ ] All correspondence endpoints follow hybrid pattern
- [ ] RFA endpoints implemented with actions
- [ ] Swagger documentation complete with examples
- [ ] Frontend API client typed and tested
- [ ] Integration tests cover all scenarios

### Non-Functional Requirements
- [ ] API response times < 200ms (p90)
- [ ] Error responses consistent and user-friendly
- [ ] Documentation auto-generated and up-to-date
- [ ] Type safety across frontend and backend
- [ ] Rate limiting and security implemented

### Compliance Requirements
- [ ] ADR-003 patterns followed consistently
- [ ] ADR-019 UUID strategy implemented
- [ ] ADR-007 error handling integrated
- [ ] ADR-010 logging for all API calls

---

## 🚀 Deployment & Rollout

### Phase 1: Backend Implementation (Week 1-2)
- Implement base controller and patterns
- Refactor correspondence API
- Create comprehensive tests

### Phase 2: Frontend Integration (Week 3)
- Update API client library
- Implement error handling UI
- Add integration tests

### Phase 3: Documentation & Monitoring (Week 4)
- Complete Swagger documentation
- Add API monitoring
- Performance testing and optimization

---

## 📋 Dependencies & Prerequisites

### Must Have
- ✅ ADR-003 Approved
- ✅ ADR-007 Error Handling Strategy
- ✅ Base infrastructure (NestJS, TypeORM, Redis)
- ✅ Authentication system (JWT, CASL)

### Nice to Have
- API analytics dashboard
- Automated API testing pipeline
- Client code generation

---

## 🔄 Review & Acceptance

### Code Review Checklist
- [ ] All endpoints follow hybrid pattern
- [ ] DTOs properly validated
- [ ] Error handling consistent
- [ ] Documentation complete
- [ ] Tests comprehensive
- [ ] Performance optimized

### Acceptance Criteria
- [ ] API documentation available at `/api/docs`
- [ ] All tests passing (>90% coverage)
- [ ] Performance benchmarks met
- [ ] Security scan passed
- [ ] Frontend integration verified

---

**Owner:** Backend Team Lead  
**Estimated Effort:** 3-4 weeks (1 developer)  
**Risk Level:** Medium (API breaking changes)  
**Rollback Plan:** Version previous API endpoints alongside new ones
