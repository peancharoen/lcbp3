# ðŸš€ GitHub Spec Kit: การใช้งานร่วมกับ Requirements & FullStackJS v1.4.5

## ðŸ"‹ ภาพรวม

GitHub Spec Kit เป็นเครื่องมือที่ช่วยให้คุณสร้าง **Issue Specifications** ที่มีโครงสร้างชัดเจนและครบถ้วนสำหรับโปรเจค LCBP3-DMS โดยอ้างอิง Requirements v1.4.5 และ FullStackJS v1.4.5

---

## ðŸŽ¯ วัตถุประสงค์หลัก

1. **แปลง Requirements เป็น Actionable Tasks** - แบ่งความต้องการขนาดใหญ่เป็น issues ขนาดเล็กที่ทำได้จริง
2. **รักษา Standards** - ทุก issue ต้องสอดคล้องกับ FullStackJS Guidelines
3. **Traceability** - อ้างอิงกลับไปยัง Requirements ได้ทุกครั้ง
4. **Consistency** - ใช้ template และรูปแบบเดียวกันทั้งโปรเจค

---

## ðŸ"š โครงสร้าง Spec Kit

### 1. **Issue Title Format**

```
[<Module>] <FeatureType>: <ShortDescription>
```

**ตัวอย่าง:**

- `[RFA] Feature: Implement RFA Creation Workflow`
- `[Auth] Security: Add Rate Limiting to Login Endpoint`
- `[File] Refactor: Implement Two-Phase Storage Strategy`

### 2. **Issue Labels**

- **Type:** `feature`, `bug`, `refactor`, `security`, `performance`
- **Priority:** `critical`, `high`, `medium`, `low`
- **Module:** `backend`, `frontend`, `database`, `infrastructure`
- **Status:** `blocked`, `in-progress`, `review-needed`

### 3. **Issue Template Structure**

```markdown
## 📋 Overview

[Brief description of what needs to be done]

## 🎯 Requirements Reference

- **Section:** [Requirements v1.4.5 - Section X.X]
- **Related:** [Link to specific requirement]

## ðŸ'» Technical Specifications

### Backend (NestJS)

- Module: `<ModuleName>`
- Files to modify:
  - [ ] `src/modules/<module>/<file>.ts`
- Dependencies: `<npm packages>`

### Frontend (Next.js)

- Pages/Components:
  - [ ] `app/<page>/page.tsx`
- Dependencies: `<npm packages>`

### Database

- Tables affected: `<table_names>`
- Migrations needed: [ ] Yes / [ ] No

## âœ… Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Security checks passed
- [ ] Tests written and passing
- [ ] Documentation updated

## ðŸ§ª Testing Requirements

- [ ] Unit tests (70% coverage minimum)
- [ ] Integration tests
- [ ] E2E tests (if applicable)

## 🔒 Security Checklist

- [ ] Input validation implemented
- [ ] RBAC permissions checked
- [ ] Audit logging added
- [ ] No sensitive data in logs

## ðŸ"— Related Issues

- Blocks: #<issue_number>
- Depends on: #<issue_number>
- Related to: #<issue_number>

## ðŸ"Œ Notes

[Any additional context, decisions, or constraints]
```

---

## ðŸ› ï¸ วิธีการใช้งาน

### **Step 1: ระบุ Feature จาก Requirements**

อ้างอิง: `0_Requirements_V1_4_5.md`

**ตัวอย่าง:**

```
Section 3.3: การจัดการเอกสารขออนุมัติ (RFA)
```

### **Step 2: สร้าง Issue Specification**

**Title:**

```
[RFA] Feature: Implement RFA Creation with Workflow Engine
```

**Overview:**

```markdown
## 📋 Overview

Implement the RFA (Request for Approval) creation workflow that allows
Document Control users to create RFAs with multiple revisions and trigger
the unified workflow engine.

## 🎯 Requirements Reference

- **Section:** Requirements v1.4.5 - Section 3.3
- **Page Reference:** Lines 250-275
- **Key Requirements:**
  - Support PDF file uploads only [3.3.2]
  - Multiple revisions support [3.3.2]
  - Draft/Submitted state management [3.3.3]
  - Integration with Unified Workflow Engine [3.3.5]
```

### **Step 3: กำหนด Technical Specs ตาม FullStackJS**

อ้างอิง: `1_FullStackJS_V1_4_5.md`

````markdown
## ðŸ'» Technical Specifications

### Backend (NestJS)

- **Module:** `RfaModule` [Section 3.9.7]
- **Files to modify:**
  - [ ] `src/modules/rfa/rfa.controller.ts`
  - [ ] `src/modules/rfa/rfa.service.ts`
  - [ ] `src/modules/rfa/dto/create-rfa.dto.ts`
  - [ ] `src/modules/workflow/workflow-engine.service.ts`

- **Dependencies:**
  ```json
  {
    "@nestjs/typeorm": "^10.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1"
  }
  ```
````

- **Implementation Guidelines:**
  - Use Two-Phase Storage for file uploads [Section 3.3]
  - Apply Optimistic Locking for race conditions [Section 3.2.1]
  - Integrate with DocumentNumberingService [Section 3.9.12]
  - Follow RBAC permissions [Section 5.4]

### Frontend (Next.js)

- **Pages/Components:**
  - [ ] `app/rfas/new/page.tsx`
  - [ ] `components/rfa/rfa-form.tsx`
  - [ ] `components/rfa/revision-manager.tsx`

- **Dependencies:**

  ```json
  {
    "react-hook-form": "^7.50.0",
    "zod": "^3.22.0",
    "@tanstack/react-query": "^5.20.0"
  }
  ```

- **State Management:** [Section 4.10]
  - Use React Query for server state
  - Use React Hook Form for form state
  - Implement auto-save drafts to localStorage [Section 4.1.1]

### Database

- **Tables affected:**
  - `rfas` - main table
  - `rfa_revisions` - revision history
  - `rfa_items` - related items
  - `workflow_instances` - workflow state

- **Migrations needed:** [ ✓ ] Yes
  - Create migration for virtual columns if using JSON [Section 3.2.2]

````

### **Step 4: กำหนด Acceptance Criteria**

```markdown
## âœ… Acceptance Criteria

### Functional Requirements
- [ ] Document Control users can create new RFAs
- [ ] Support PDF file upload (max 50MB) [Section 3.10.1]
- [ ] RFA can have multiple revisions [Section 3.3.2]
- [ ] RFA number auto-generated using format template [Section 3.11]
- [ ] Draft state allows editing, Submitted state is read-only [Section 3.3.3]
- [ ] Triggers workflow engine on submission [Section 3.3.5]

### Non-Functional Requirements
- [ ] API response time < 200ms (excluding file processing) [Section 6.4]
- [ ] Virus scanning implemented for all uploads [Section 3.10.2]
- [ ] File integrity checks (checksum) performed [Section 3.10.3]
- [ ] Audit log entry created for all actions [Section 6.1]
- [ ] RBAC permissions enforced (rfas.create) [Section 5.4.2]

### Security Requirements
- [ ] Input validation using class-validator [Section 2.1]
- [ ] Rate limiting applied (1000 req/hour for Editor) [Section 6.5.1]
- [ ] No sensitive data in error messages [Section 6.5.4]
- [ ] Download links expire after 24 hours [Section 3.10.2]
````

### **Step 5: กำหนด Testing Requirements**

```markdown
## ðŸ§ª Testing Requirements

### Unit Tests (Jest) [Section 3.14]

- [ ] RfaService.create() - success case
- [ ] RfaService.create() - validation failures
- [ ] RfaService.create() - file upload failures
- [ ] RfaService.create() - race condition handling
- [ ] DocumentNumberingService integration
- **Target Coverage:** 70% minimum [Section 7.1]

### Integration Tests (Supertest) [Section 7.2]

- [ ] POST /api/rfas - with valid file upload
- [ ] POST /api/rfas - with invalid file type
- [ ] POST /api/rfas - with virus-infected file
- [ ] POST /api/rfas - without required permissions
- [ ] Workflow engine integration test

### E2E Tests (Playwright) [Section 7.3]

- [ ] Complete RFA creation flow
- [ ] File upload with drag-and-drop
- [ ] Form auto-save and recovery
- [ ] Error handling and user feedback

### Security Tests [Section 7.4]

- [ ] SQL injection attempts blocked
- [ ] XSS attacks prevented
- [ ] File upload security bypass attempts
- [ ] Rate limiting enforcement
```

### **Step 6: Security Checklist**

```markdown
## 🔒 Security Checklist [Section 6.5]

### Input Validation

- [ ] All DTOs use class-validator [Section 3.1]
- [ ] File type white-list enforced (PDF only) [Section 3.10.1]
- [ ] File size limit checked (50MB max) [Section 3.10.1]
- [ ] JSON schema validation for details field [Section 3.12]

### Authentication & Authorization

- [ ] JWT token validation [Section 5.1]
- [ ] RBAC permission check (rfas.create) [Section 5.4]
- [ ] Organization scope validation [Section 4.2]
- [ ] Session tracking implemented [Section 6.5.4]

### Data Protection

- [ ] Audit log entry created [Section 8.1]
- [ ] Sensitive data not logged [Section 6.5.4]
- [ ] File integrity checksum stored [Section 3.10.3]
- [ ] Virus scanning completed [Section 3.10.2]

### Rate Limiting [Section 6.5.1]

- [ ] Editor: 1000 req/hour
- [ ] File Upload: 50 req/hour
- [ ] Fallback for rate limiter failures
```

---

## ðŸ"Š ตัวอย่าง Issue ที่สมบูรณ์

### Issue #1: [RFA] Feature: Implement RFA Creation with Workflow Engine

````markdown
## 📋 Overview

Implement the RFA (Request for Approval) creation workflow that allows
Document Control users to create RFAs with multiple revisions and trigger
the unified workflow engine.

## 🎯 Requirements Reference

- **Section:** Requirements v1.4.5 - Section 3.3
- **Lines:** 250-275
- **Key Requirements:**
  - วัตถุประสงค์: เอกสารขออนุมัติ (RFA) ภายใน โครงการ [3.3.1]
  - ประเภทเอกสาร: รองรับเอกสารรูปแบบ ไฟล์ PDF [3.3.2]
  - รองรับ Multiple Revisions [3.3.2]
  - Draft/Submitted State Management [3.3.3]
  - Unified Workflow Integration [3.3.5]

## ðŸ'» Technical Specifications

### Backend (NestJS)

**Module:** `RfaModule` [FullStackJS Section 3.9.7]

**Files to create/modify:**

- [ ] `src/modules/rfa/rfa.controller.ts`
- [ ] `src/modules/rfa/rfa.service.ts`
- [ ] `src/modules/rfa/dto/create-rfa.dto.ts`
- [ ] `src/modules/rfa/entities/rfa.entity.ts`
- [ ] `src/modules/rfa/entities/rfa-revision.entity.ts`
- [ ] `src/modules/workflow/workflow-engine.service.ts`

**Dependencies:**

```json
{
  "@nestjs/typeorm": "^10.0.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.1",
  "uuid": "^9.0.0"
}
```
````

**Implementation Guidelines:**

1. **File Storage:** Use Two-Phase Storage Strategy [FullStackJS 3.3]
   - Phase 1: Upload to `temp/` with virus scan
   - Phase 2: Move to `permanent/{YYYY}/{MM}/` on commit

2. **Concurrency:** Apply Optimistic Locking [FullStackJS 3.2.1]

   ```typescript
   @VersionColumn()
   version: number;
   ```

3. **Document Numbering:** [FullStackJS 3.9.12]
   - Inject `DocumentNumberingService`
   - Use Redis distributed lock for counter
   - Format: `{ORG}-RFA-{DISCIPLINE}-{SEQ:4}-{REV}`

4. **Workflow Integration:** [FullStackJS 3.9.14]
   - Call `WorkflowEngineService.createInstance()`
   - Set initial state to 'DRAFT'
   - Transition to workflow on submission

### Frontend (Next.js)

**Pages/Components:**

- [ ] `app/rfas/new/page.tsx` - Main creation page
- [ ] `components/rfa/rfa-form.tsx` - Form component
- [ ] `components/rfa/revision-manager.tsx` - Revision UI
- [ ] `components/file-upload/multi-file-upload.tsx` - File upload

**Dependencies:**

```json
{
  "react-hook-form": "^7.50.0",
  "zod": "^3.22.0",
  "@tanstack/react-query": "^5.20.0",
  "react-dropzone": "^14.2.3"
}
```

**State Management:** [FullStackJS 4.10]

- **Server State:** React Query for RFA data
- **Form State:** React Hook Form + Zod validation
- **Auto-save:** LocalStorage for drafts [FullStackJS 4.1.1]

**File Upload UX:** [FullStackJS 5.7]

```typescript
// Multi-file drag-and-drop
// Distinguish between "Main Document" and "Supporting Attachments"
// Show virus scan progress
// Display file type icons and security warnings
```

### Database

**Tables affected:**

- `rfas` - Main RFA table
- `rfa_revisions` - Revision history
- `rfa_items` - Related items
- `workflow_instances` - Workflow state
- `attachments` - File metadata
- `rfa_attachments` - Junction table

**Migrations needed:** [ ✓ ] Yes

```sql
-- Example migration structure
CREATE TABLE rfas (
  rfa_id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  rfa_number VARCHAR(100) UNIQUE NOT NULL,
  current_state VARCHAR(50),
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);
```

## âœ… Acceptance Criteria

### Functional Requirements

- [ ] Document Control users can create new RFAs
- [ ] Support PDF file upload (max 50MB) [Req 3.10.1]
- [ ] RFA can have multiple revisions [Req 3.3.2]
- [ ] RFA number auto-generated: `{ORG}-RFA-{DISCIPLINE}-{SEQ:4}-{REV}` [Req 3.11]
- [ ] Draft state allows editing, Submitted state is read-only [Req 3.3.3]
- [ ] Admin can cancel/revert submitted RFAs [Req 3.3.3]
- [ ] Triggers unified workflow engine on submission [Req 3.3.5]
- [ ] Can reference Shop Drawings in RFA [Req 3.3.4]

### Non-Functional Requirements

- [ ] API response time < 200ms (excluding file processing) [Req 6.4]
- [ ] File upload completes < 30 seconds for 50MB [Req 6.4]
- [ ] Virus scanning implemented (ClamAV) [Req 3.10.2]
- [ ] File integrity checks (checksum) performed [Req 3.10.3]
- [ ] Audit log entry created for all actions [Req 6.1]
- [ ] RBAC permissions enforced (rfas.create, rfas.respond) [Req 5.4.2]

### UI/UX Requirements [FullStackJS 5.7]

- [ ] Form uses React Hook Form + Zod validation
- [ ] Multi-file drag-and-drop interface
- [ ] Clear distinction between main document and attachments
- [ ] Real-time virus scan feedback
- [ ] File type indicators and security warnings
- [ ] Auto-save draft to localStorage every 30 seconds
- [ ] Mobile-responsive (Card View on small screens)

### Security Requirements [Req 6.5]

- [ ] Input validation using class-validator
- [ ] Rate limiting: Editor 1000 req/hour, File Upload 50 req/hour
- [ ] No sensitive data in error messages
- [ ] Download links expire after 24 hours
- [ ] Files stored outside web root
- [ ] Access control checks before file download

## ðŸ§ª Testing Requirements

### Unit Tests (Jest) [FullStackJS 3.14]

```typescript
describe('RfaService', () => {
  describe('create', () => {
    it('should create RFA with valid data');
    it('should reject invalid file types');
    it('should handle race conditions with optimistic locking');
    it('should generate correct RFA number');
    it('should trigger workflow on submission');
  });
});
```

- **Target Coverage:** 70% minimum [Req 7.1]

### Integration Tests (Supertest) [FullStackJS 3.14]

```typescript
describe('POST /api/rfas', () => {
  it('should create RFA with file upload');
  it('should reject virus-infected files');
  it('should enforce RBAC permissions');
  it('should create workflow instance');
});
```

### E2E Tests (Playwright) [FullStackJS 4.9]

```typescript
test('Complete RFA creation flow', async ({ page }) => {
  // Login as Document Control user
  // Navigate to RFA creation page
  // Fill form with test data
  // Upload main document (PDF)
  // Upload supporting attachment
  // Verify auto-save works
  // Submit RFA
  // Verify workflow starts
});
```

### Security Tests [Req 7.4]

- [ ] SQL injection attempts blocked
- [ ] XSS attacks prevented
- [ ] File upload security bypass attempts
- [ ] Rate limiting enforcement
- [ ] Unauthorized access attempts blocked

## 🔒 Security Checklist [Req 6.5]

### Input Validation

- [ ] All DTOs use class-validator decorators
- [ ] File type white-list enforced (PDF only)
- [ ] File size limit checked (50MB max)
- [ ] JSON schema validation for details field
- [ ] Sanitize all user inputs

### Authentication & Authorization

- [ ] JWT token validation on all endpoints
- [ ] RBAC permission check (rfas.create, rfas.respond)
- [ ] Organization scope validation
- [ ] Project membership validation
- [ ] Session tracking and concurrent session limits

### Data Protection

- [ ] Audit log entry for: create, update, submit, cancel
- [ ] Sensitive data not logged (file contents, user emails)
- [ ] File integrity checksum stored in database
- [ ] Virus scanning before file is accessible
- [ ] Encrypted storage for sensitive metadata

### Rate Limiting [Req 6.5.1]

- [ ] Document Control: 2000 req/hour
- [ ] File Upload: 50 req/hour per user
- [ ] Graceful degradation if Redis unavailable
- [ ] Alert on rate limit violations

## ðŸ"— Related Issues

- **Depends on:**
  - #<issue> FileStorageService implementation
  - #<issue> WorkflowEngine implementation
  - #<issue> DocumentNumberingService implementation

- **Blocks:**
  - #<issue> RFA Response/Approval workflow
  - #<issue> RFA Reports and Analytics

- **Related to:**
  - #<issue> Shop Drawing reference system
  - #<issue> Unified Workflow Engine

## ðŸ"Œ Notes

### Design Decisions

1. **Why Two-Phase Storage?**
   - Prevents orphan files if transaction fails
   - Allows virus scanning before commitment
   - Reference: FullStackJS Section 3.3

2. **Why Application-level Locking?**
   - More portable than database stored procedures
   - Better observability with Redis
   - Reference: FullStackJS Section 3.9.12

3. **Why Optimistic Locking?**
   - Better performance than pessimistic locks
   - Handles concurrent updates gracefully
   - Reference: FullStackJS Section 3.2.1

### Implementation Order

1. Backend: Entity, DTO, Service (with tests)
2. Backend: Controller, Guards, Interceptors
3. Database: Migration scripts
4. Frontend: Form component (with validation)
5. Frontend: File upload component
6. Frontend: Integration with API
7. E2E: Complete user flow test

### Risk Mitigation

- **File Upload Failures:** Implement retry with exponential backoff
- **Virus Scan Downtime:** Queue files for later scanning, block download
- **Database Contention:** Redis lock + Optimistic lock dual protection
- **Large Files:** Stream uploads, show progress indicator

---

## ðŸ"Œ Labels

`feature` `backend` `frontend` `database` `high-priority` `requires-testing`

## 👤 Assignment

- **Backend:** @backend-team
- **Frontend:** @frontend-team
- **QA:** @qa-team

## ⏱ï¸ Estimated Effort

- **Backend:** 5 days
- **Frontend:** 3 days
- **Testing:** 2 days
- **Total:** 10 days

````

---

## ðŸ"§ Best Practices

### 1. **ความละเอียดที่เหมาะสม**
- ✅ **DO:** แบ่ง issue ให้ทำเสร็จภายใน 1-2 สัปดาห์
- ❌ **DON'T:** สร้าง issue ขนาดใหญ่ที่ใช้เวลาเป็นเดือน

### 2. **การอ้างอิง**
- ✅ **DO:** อ้างอิง section และ line numbers จาก Requirements
- ✅ **DO:** อ้างอิง section จาก FullStackJS Guidelines
- ❌ **DON'T:** Copy-paste ข้อความยาวๆ ทั้งหมด

### 3. **Acceptance Criteria**
- ✅ **DO:** เขียนเป็นข้อๆ ที่ตรวจสอบได้ (testable)
- ✅ **DO:** แยก functional และ non-functional requirements
- ❌ **DON'T:** เขียนคลุมเครือ เช่น "ระบบต้องเร็ว"

### 4. **Testing**
- ✅ **DO:** ระบุ test cases ที่ต้องเขียนชัดเจน
- ✅ **DO:** ระบุ coverage target (70% minimum)
- ❌ **DON'T:** ปล่อยให้ "เขียน test ภายหลัง"

### 5. **Security**
- ✅ **DO:** มี Security Checklist ทุก issue ที่เกี่ยวกับ user input
- ✅ **DO:** ระบุ permission ที่ต้องใช้ชัดเจน
- ❌ **DON'T:** คิดว่า "จะเพิ่ม security ทีหลัง"

---

## ðŸ"Š Issue Workflow

```mermaid
graph LR
    A[Create Issue from Req] --> B[Add Technical Specs]
    B --> C[Define Acceptance Criteria]
    C --> D[Add Testing Requirements]
    D --> E[Security Checklist]
    E --> F[Link Related Issues]
    F --> G[Assign & Estimate]
    G --> H[Ready for Development]
````

---

## âœ… สรุป: ขั้นตอนการสร้าง Issue ที่สมบูรณ์

1. **ระบุ Requirement** - เลือก section จาก Requirements v1.4.5
2. **สร้าง Title** - ใช้รูปแบบ `[Module] Type: Description`
3. **เขียน Overview** - สรุปสั้นๆ ว่าต้องทำอะไร
4. **อ้างอิง Requirements** - ระบุ section และ line numbers
5. **กำหนด Technical Specs** - แยกเป็น Backend, Frontend, Database
6. **ใช้ FullStackJS Guidelines** - อ้างอิง section ที่เกี่ยวข้อง
7. **เขียน Acceptance Criteria** - แยก functional/non-functional
8. **ระบุ Testing Requirements** - Unit, Integration, E2E
9. **Security Checklist** - ครอบคลุม OWASP Top 10
10. **Link Related Issues** - ระบุ dependencies และ blockers
11. **เพิ่ม Labels & Assignment** - ใส่ label และมอบหมายงาน
12. **Estimate Effort** - ประมาณการเวลาที่ใช้

---

**เอกสารนี้เป็น Living Document และจะถูกปรับปรุงตามความต้องการของทีมพัฒนา**
