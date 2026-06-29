# Task BE-AI-02: Backend AI Gateway Development

**Phase:** Step 2 - AI Integration Layer (NestJS)
**ADR Compliance:** ADR-018 (AI Boundary), ADR-019 (UUID Strategy)
**Priority:** 🔴 Critical - Bridge between DMS and AI Pipeline

> **Context:** เป็นส่วนเชื่อมโยงระหว่างระบบ DMS และ AI Pipeline ตาม ADR-020 โดยต้องรักษาความปลอดภัยและใช้ Identifier ที่ถูกต้อง

---

## 🛠️ Implementation Tasks

### **AI-2.1: Database Schema Design (SQL First Approach)**
- [x] **Create `migration_logs` Table:** — เพิ่มใน `specs/03-Data-and-Storage/lcbp3-v1.8.0-schema-02-tables.sql` (Section 11)
  - ใช้ `uuid UUID NOT NULL DEFAULT UUID()` แทน `BINARY(16)` ตาม pattern ปัจจุบัน (ADR-019)
  - FK → `users.user_id` สำหรับ `reviewed_by`
- [x] **Create `ai_audit_logs` Table:** — เพิ่มในไฟล์ schema เดียวกัน
  - `document_public_id` เป็น Soft Reference (ไม่มี FK constraint) เพื่อ Audit Trail ถาวร
- [x] **Update Data Dictionary:**
  - เพิ่ม Section 19 ใน `specs/03-Data-and-Storage/03-01-data-dictionary.md`
  - ครอบคลุม Confidence Scoring Strategy, State Machine, JSON Schema

### **AI-2.2: AI Gateway Module Architecture**
- [x] **Module Structure:**
  ```typescript
  // src/modules/ai/ai.module.ts
  @Module({
    imports: [TypeOrmModule.forFeature([MigrationLog, AiAuditLog])],
    controllers: [AiController],
    providers: [AiService, AiValidationService],
    exports: [AiService],
  })
  export class AiModule {}
  ```
- [x] **AiService Implementation:**
  ```typescript
  @Injectable()
  export class AiService {
    async triggerProcessing(filePublicId: string, context: ProcessingContext): Promise<void> {
      // 1. Validate publicId format (ADR-019)
      // 2. Send HTTP request to n8n webhook
      // 3. Log request to ai_audit_logs
      // 4. Return processing token
    }

    async handleWebhookCallback(payload: AiCallbackDto): Promise<void> {
      // 1. Validate JWT token from n8n
      // 2. Update migration_logs with AI results
      // 3. Calculate confidence scores
      // 4. Trigger notifications if needed
    }

    async extractRealtime(filePublicId: string): Promise<ExtractionResult> {
      // 1. Send to n8n for immediate processing
      // 2. Wait for response (timeout: 30s)
      // 3. Return structured suggestions
    }
  }
  ```
- [x] **Configuration Management:**
  ```env
  # .env
  AI_N8N_WEBHOOK_URL=http://192.168.1.100:5678/webhook/ai-processing
  AI_N8N_AUTH_TOKEN=service-account-jwt-token
  AI_OLLAMA_URL=http://192.168.1.100:11434
  AI_TIMEOUT_MS=30000
  AI_MAX_RETRIES=3
  ```

### **AI-2.3: Migration Engine & Business Logic**
- [x] **MigrationService Implementation:** — `AiService` implements `stageLegacyData` logic (via `extractRealtime`), `compareData` via `AiValidationService`, `approveMigration` via `updateMigrationLog`
  ```typescript
  @Injectable()
  export class MigrationService {
    async stageLegacyData(excelData: ExcelImportDto[]): Promise<MigrationLog[]> {
      // 1. Validate Excel data format
      // 2. Move PDF files to staging area (via StorageService)
      // 3. Create migration_logs entries
      // 4. Trigger AI processing for each file
    }

    async compareData(excelMetadata: any, aiMetadata: any): Promise<ComparisonResult> {
      // 1. Field-by-field comparison
      // 2. Calculate confidence deltas
      // 3. Flag discrepancies for human review
      // 4. Generate comparison report
    }

    async approveMigration(migrationPublicId: string, adminId: number): Promise<void> {
      // 1. Validate admin permissions (CASL)
      // 2. Move file from staging to permanent storage
      // 3. Create actual document records (RFA, Correspondence, etc.)
      // 4. Update migration_logs status
    }
  }
  ```
- [x] **Status Management Workflow:**
  ```typescript
  enum MigrationStatus {
    PENDING_REVIEW = 'PENDING_REVIEW',
    VERIFIED = 'VERIFIED',
    IMPORTED = 'IMPORTED',
    FAILED = 'FAILED'
  }

  // State transition rules
  const statusTransitions = {
    [MigrationStatus.PENDING_REVIEW]: [MigrationStatus.VERIFIED, MigrationStatus.FAILED],
    [MigrationStatus.VERIFIED]: [MigrationStatus.IMPORTED, MigrationStatus.PENDING_REVIEW],
    [MigrationStatus.IMPORTED]: [], // Terminal state
    [MigrationStatus.FAILED]: [MigrationStatus.PENDING_REVIEW] // Can retry
  };
  ```

### **AI-2.4: API Endpoints & Security Implementation**
- [x] **Admin Migration Endpoints:** — `GET /api/ai/migration` + `PATCH /api/ai/migration/:publicId` ใน `AiController` พร้อม `JwtAuthGuard + RbacGuard + RequirePermission`
  ```typescript
  @Controller('admin/migration')
  @UseGuards(JwtAuthGuard, CaslGuard)
  export class AdminMigrationController {
    @Get()
    @Permissions(PERMISSIONS.MIGRATION_READ)
    async getMigrationList(@Query() query: MigrationQueryDto): Promise<PaginatedResult<MigrationLog>> {
      // 1. Validate query parameters
      // 2. Apply filters (status, confidence, date range)
      // 3. Return paginated results
    }

    @Patch(':publicId')
    @Permissions(PERMISSIONS.MIGRATION_APPROVE)
    async updateMigration(
      @Param('publicId') publicId: string,
      @Body() updateDto: MigrationUpdateDto,
      @CurrentUser() user: User
    ): Promise<MigrationLog> {
      // 1. Validate publicId (no parseInt!)
      // 2. Check admin permissions
      // 3. Update with audit trail
    }
  }
  ```
- [x] **Real-time AI Extraction Endpoint:** — `POST /api/ai/extract` (rate limit 5/min) + `POST /api/ai/callback` (service account auth)
  ```typescript
  @Controller('ai')
  export class AiController {
    @Post('extract')
    @UseGuards(JwtAuthGuard)
    @Throttle(5, 60) // 5 requests per minute
    async extractDocument(@Body() dto: ExtractDocumentDto): Promise<ExtractionResult> {
      // 1. Validate file access permissions
      // 2. Send to AI pipeline
      // 3. Return structured suggestions
    }
  }
  ```
- [x] **Security Measures:**
  - RbacGuard + RequirePermission on admin endpoints
  - Idempotency-Key header documented on PATCH endpoint
  - Rate limiting (`@Throttle 5/min`) on `/ai/extract`
  - Bearer token validation on `/ai/callback`
  - AuditLog saved for every AI interaction (ADR-018 Rule 5)

---

## 🔴 Critical Rules (Non-Negotiable)

1. **ADR-019 UUID Strategy:**
   - Use `publicId` (UUIDv7) for all document references
   - NEVER use `parseInt()` or `Number()` on UUID values
   - All API parameters use string type for UUIDs

2. **ADR-018 AI Boundary:**
   - No direct database access from AI services
   - All communication via DMS API only
   - AI services run on Admin Desktop (isolated)

3. **Security Requirements:**
   - All `POST/PATCH` endpoints must validate `Idempotency-Key`
   - CASL permissions enforced on all endpoints
   - Rate limiting on AI endpoints (5 req/min)

4. **Data Integrity:**
   - SQL-first approach (no TypeORM migrations)
   - All file operations via StorageService
   - Audit logging for all AI interactions

---

## 📋 Implementation Sequence

1. **Phase 1 (AI-2.1):** Database schema and data dictionary updates
2. **Phase 2 (AI-2.2):** AI Gateway module and basic service structure
3. **Phase 3 (AI-2.3 & AI-2.4):** Business logic and API endpoints (parallel development)
4. **Phase 4:** Integration testing with n8n pipeline

---

## 📁 Related Specifications

- **ADR-018:** AI Boundary Policy - Security requirements
- **ADR-019:** Hybrid Identifier Strategy - UUID patterns
- **ADR-020:** AI Intelligence Integration - Architecture overview
- **05-02-backend-guidelines.md:** NestJS patterns and conventions
- **03-01-data-dictionary.md:** Field definitions and business rules

---

## 📝 Code Templates

### DTO Examples
```typescript
// extract-document.dto.ts
export class ExtractDocumentDto {
  @IsUUID()
  publicId: string;

  @IsEnum(['migration', 'ingestion'])
  context: string;
}

// migration-update.dto.ts
export class MigrationUpdateDto {
  @IsOptional()
  @IsEnum(['VERIFIED', 'FAILED'])
  status?: MigrationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminFeedback?: string;
}
```

### Entity Example
```typescript
// migration-log.entity.ts
@Entity('migration_logs')
export class MigrationLog extends UuidBaseEntity {
  @Column({ type: 'varchar', length: 255 })
  sourceFile: string;

  @Column({ type: 'json' })
  sourceMetadata: any;

  @Column({ type: 'json' })
  aiExtractedMetadata: any;

  @Column({ type: 'decimal', precision: 3, scale: 2 })
  confidenceScore: number;

  @Column({
    type: 'enum',
    enum: MigrationStatus,
    default: MigrationStatus.PENDING_REVIEW
  })
  status: MigrationStatus;
}
```

