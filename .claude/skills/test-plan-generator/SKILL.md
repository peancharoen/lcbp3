---
name: test-plan-generator
description: สร้างแผนการทดสอบรวม (unified test plan) จากสเปคหลายตัวใน 200-fullstacks ที่เกี่ยวข้องกับฟีเจอร์เดียวกัน ครอบคลุม Browser E2E, Backend Unit, Integration, Performance, Security & RBAC
version: 1.9.0
scope: testing
depends-on: []
handoffs-to: [109-speckit-tester, e2e-testing, check-real-app]
user-invocable: true
---

# Test Plan Generator Skill

สร้างแผนการทดสอบรวม (unified test plan) ที่ครอบคลุมสเปคหลายตัวใน `specs/200-fullstacks/` (หรือโฟลเดอร์อื่น) ที่เกี่ยวข้องกับฟีเจอร์เดียวกัน โดยอ่าน FR, Acceptance Scenarios, Edge Cases, Success Criteria จากแต่ละสเปค ตรวจสถานะ implementation จริง แล้วสร้าง test plan เป็นไฟล์ Markdown ไปไว้ที่ `specs/999-test-plan/`

## When to Use

เรียกใช้เมื่อ:
- ต้องการสร้างแผนทดสอบรวมสำหรับฟีเจอร์ที่มีหลายสเปคเกี่ยวข้อง (เช่น `/admin/migration` มี 228, 242, 244, 252)
- ต้องการทดสอบฟีเจอร์ที่ครอบคลุมทั้ง Backend + Frontend + Integration + Security
- ต้องการปิด coverage gap หลังจาก implementation เสร็จ
- ต้องการวางแผนทดสอบก่อน UAT หรือ Go-Live

## ไม่ควรใช้เมื่อ

- ต้องการรัน test จริง → ใช้ `109-speckit-tester`
- ต้องการสร้าง checklist ตรวจสอบคุณภาพ requirements → ใช้ `205-speckit-checklist`
- ต้องการ validate implementation ตาม spec → ใช้ `111-speckit-validate`
- ต้องการทดสอบผ่าน browser จริง → ใช้ `check-real-app`

## User Input

```text
$ARGUMENTS
```

ค่าที่ส่งได้:
- ชื่อฟีเจอร์หรือ path ของหน้าจอ (เช่น `/admin/migration`, `correspondence`, `transmittals`)
- ชื่อสเปคเฉพาะที่ต้องการรวม (เช่น `228 244 252`)
- ถ้าว่าง → ถาม user ว่าต้องการทดสอบฟีเจอร์อะไร

## Role

คุณคือ **Test Plan Architect** หน้าที่คือสร้างแผนการทดสอบรวมที่ครอบคลุม ตรวจสอบได้จริง และจัดลำดับตามความสำคัญ โดยอ้างอิงจากสเปคและสถานะ implementation จริงใน codebase

## Task

### Execution Steps

#### Step 1 — ระบุขอบเขต (Scope Discovery)

1. **ถาม user** (ถ้า `$ARGUMENTS` ว่าง):
   - ฟีเจอร์หรือหน้าจอที่ต้องการทดสอบคืออะไร?
   - มีสเปคเฉพาะที่ต้องการรวมหรือไม่?

2. **ค้นหาสเปคที่เกี่ยวข้อง** จาก `specs/200-fullstacks/`:
   ```bash
   ls specs/200-fullstacks/ | grep -i -E "migrat|<keyword>"
   ```
   - ค้นด้วย keyword จากชื่อฟีเจอร์ (เช่น "migration", "correspondence", "transmittal")
   - อ่าน `README.md` ใน `200-fullstacks/` เพื่อดูรายการสเปคทั้งหมด
   - ตรวจสอบโฟลเดอร์อื่นด้วย (`100-Infrastructures/`, `300-others/`) ถ้าเกี่ยวข้อง

3. **แยกสเปคออกเป็น 2 กลุ่ม**:
   - **Core Specs** — สเปคที่ implement ฟีเจอร์นั้นโดยตรง
   - **Supporting Specs** — สเปคที่ฟีเจอร์ใช้แต่ไม่ใช่ฟีเจอร์หลัก

4. **ตรวจสอบ dependency flow** — วาดภาพความสัมพันธ์ระหว่างสเปค (dependency graph)

#### Step 2 — อ่านสเปคและสกัดข้อมูล (Spec Extraction)

สำหรับแต่ละ Core Spec ให้อ่านไฟล์ต่อไปนี้ (ถ้ามี):

| ไฟล์ | สกัดอะไร |
|------|----------|
| `spec.md` | FR (Functional Requirements), Acceptance Scenarios, Edge Cases, Success Criteria, Key Entities |
| `plan.md` | แผนการ implement, dependencies, API contracts |
| `tasks.md` | รายการงาน, สถานะ (done/pending) |
| `test-report.md` | ผล test ที่มีอยู่, coverage |
| `validation-report.md` | ผล validation, ช่องว่างที่เหลือ |
| `test-plan.md` (ถ้ามี) | test plan เดิมที่มีอยู่ — อ้างอิงและขยาย ไม่ทับซ้ำ |

**สกัดข้อมูลเป็นตาราง**:

```
| FR ID | Description | Spec Source | Status |
|-------|-------------|-------------|--------|
| FR-001 | ... | 244 spec.md | implemented |
```

#### Step 3 — ตรวจสถานะ Implementation จริง (Implementation Audit)

ตรวจ codebase จริงเพื่อยืนยันสถานะ:

1. **Backend**:
   ```bash
   # หา module ที่เกี่ยวข้อง
   ls backend/src/modules/<module>/
   # ตรวจ test files
   find backend/src/modules/<module> -name "*.spec.ts" | wc -l
   # ตรวจ coverage (ถ้ารันได้)
   cd backend && pnpm test:cov -- --collectCoverageFrom='src/modules/<module>/**'
   ```

2. **Frontend**:
   ```bash
   # หา page ที่เกี่ยวข้อง
   find frontend/app -path "*<feature>*" -name "page.tsx"
   # ตรวจ test files
   find frontend -path "*<feature>*" -name "*.test.*" -o -name "*.spec.*"
   ```

3. **บันทึกสถานะ** แต่ละสเปค:
   - `Implemented` — โค้ดมี + test ผ่าน
   - `Partial` — โค้ดมีบางส่วน หรือ test ยังไม่ครบ
   - `Draft` — ยังไม่ implement
   - `Specified` — spec เสร็จแต่ยังไม่ implement

#### Step 4 — ระบุช่องว่าง (Gap Analysis)

เปรียบเทียบสิ่งที่สเปคกำหนด vs สิ่งที่มีอยู่จริง:

| ประเภทช่องว่าง | วิธีตรวจ |
|---------------|----------|
| **Test coverage gap** | ไฟล์ที่ไม่มี `.spec.ts` หรือ coverage < 80% |
| **Browser E2E gap** | ไม่มีการทดสอบผ่าน browser จริง |
| **Edge case ไม่ถูกทดสอบ** | Edge cases ใน spec ที่ไม่มี test ครอบคลุม |
| **RBAC ไม่ถูกทดสอบ** | CASL guard ที่ไม่มี test สำหรับแต่ละ role |
| **Performance ไม่ถูกวัด** | Success Criteria ที่ไม่มี benchmark test |

จัดลำดับช่องว่างตามความสำคัญ:
- **P1** — บล็อกการใช้งานจริง (เช่น browser E2E, ไม่มี test เลย)
- **P2** — coverage gap สำคัญ (เช่น controller 0% coverage)
- **P3** — ปรับปรุงคุณภาพ (เช่น benchmark, edge case เพิ่มเติม)

#### Step 5 — สร้างแผนการทดสอบ (Generate Test Plan)

สร้างไฟล์ test plan ตาม template ใน `templates/test-plan-template.md`

**โครงสร้างหลัก**:

```
1. สเปคที่เกี่ยวข้อง (Core + Supporting + Dependency Flow)
2. โครงสร้างการทดสอบ (Phase overview)
3. Phase 1: Browser E2E (P1)
4. Phase 2: Backend Unit Tests (P2)
5. Phase 3: Integration Tests (P2)
6. Phase 4: Performance Tests (P3)
7. Phase 5: Security & RBAC Tests (P2)
8. ไฟล์ทดสอบสรุป
9. ลำดับการทำ (Execution Order)
10. เกณฑ์ผ่าน (Acceptance Criteria)
11. ความเสี่ยงและการจัดการ
12. งานที่เกี่ยวข้อง (Cross-Reference)
```

**กฎการเขียน test case**:

แต่ละ test case ต้องมี:
- **ขั้นตอน** — หมายเลข + การกระทำ
- **ผลที่คาดหวาง** — ผลลัพธ์ที่ตรวจสอบได้
- **FR/Spec** — อ้างอิง FR ID หรือ Spec name

ตัวอย่าง:
```
| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | ล็อกอินเป็น Document Controller, เข้า `/admin/migration` | แสดง Review Queue | 244 FR-004 |
```

**กฎการจัด Phase**:

| Phase | สถานการณ์ที่ครอบคลุม | Priority |
|-------|---------------------|----------|
| Phase 1: Browser E2E | ทดสอบผ่านเบราว์เซอร์จริง — UI flow, RBAC, edge cases, console/network | P1 |
| Phase 2: Backend Unit | ปิด coverage gap — controller, service, worker, adapter | P2 |
| Phase 3: Integration | End-to-end flow ข้ามหลาย service — staging → AI → commit → RAG | P2 |
| Phase 4: Performance | Benchmark ตาม Success Criteria — timing, memory, accuracy | P3 |
| Phase 5: Security & RBAC | CASL guard, UUID compliance, AI boundary, idempotency, audit trail | P2 |

#### Step 6 — ตั้งชื่อไฟล์และบันทึก

**ตั้งชื่อไฟล์**:
- รูปแบบ: `{feature}-{scope}-test-plan.md`
- ตัวอย่าง:
  - `migration-admin-unified-test-plan.md`
  - `correspondence-crud-test-plan.md`
  - `transmittals-circulation-test-plan.md`
  - `ai-chat-integration-test-plan.md`

**บันทึกไปที่**:
```
specs/999-test-plan/{filename}.md
```

ถ้าโฟลเดอร์ `999-test-plan/` ไม่มี ให้สร้างขึ้น

#### Step 7 — สรุปผล (Report)

แสดงสรุปให้ user:
- จำนวนสเปคที่เกี่ยวข้อง (Core + Supporting)
- จำนวน test cases ทั้งหมด (แยกตาม Phase)
- ช่องว่างที่พบ (แยาตาม priority)
- ไฟล์ที่สร้าง (full path)
- ลำดับการทำแนะนำ

## Operating Principles

### หลักการสำคัญ

1. **อ้างอิงจริง** — ทุก test case ต้องอ้างอิง FR ID หรือ Edge Case จากสเปคจริง ห้ามแต่งขึ้นเอง
2. **ตรวจสถานะจริง** — ตรวจ codebase จริงก่อนบันทึกสถานะ implementation ห้ามเดา
3. **ไม่ทับซ้ำ** — ถ้ามี test plan เดิมในสเปค ให้อ้างอิงและขยาย ไม่สร้างใหม่ทับ
4. **จัดลำดับตามความสำคัญ** — P1 (บล็อกการใช้งาน) → P2 (coverage gap) → P3 (ปรับปรุง)
5. **ครอบคลุมทุกมิติ** — ไม่ใช่แค่ unit test ต้องมี Browser E2E, Integration, Performance, Security
6. **ตรวจสอบได้** — ทุก test case ต้องมีผลที่ตรวจสอบได้ชัดเจน (ไม่ใช่ "ทำงานถูกต้อง")
7. **Cross-reference** — เชื่อมโยง test case กับ FR, Edge Case, และ ADR ที่เกี่ยวข้อง

### กฎเฉพาะของ LCBP3-DMS

1. **ADR-019 UUID** — ทุก test case ที่เกี่ยวกับ API ต้องตรวจว่าใช้ `publicId` (UUIDv7) ไม่ใช่ INT PK
2. **ADR-016 RBAC** — ทุก endpoint ต้องมี test สำหรับแต่ละ role (Superadmin, Org Admin, Document Controller, Viewer)
3. **ADR-023A AI Boundary** — ทุก test ที่เกี่ยวกับ AI ต้องตรวจ `projectPublicId` filter ใน Qdrant
4. **ADR-008 BullMQ** — ทุก test ที่เกี่ยวกับ background job ต้องตรวจ retry + dead-letter
5. **ADR-007 Error Handling** — ทุก test case ต้องครอบคลุม error path ไม่ใช่แค่ happy path
6. **Domain Terminology** — ใช้คำจาก glossary (Correspondence, RFA, Transmittal, Circulation) ไม่ใช่คำทั่วไป

### ข้อห้าม

- ❌ ห้ามสร้าง test case ที่ไม่อ้างอิง FR หรือ Edge Case ใด
- ❌ ห้ามเดาสถานะ implementation โดยไม่ตรวจ codebase
- ❌ ห้ามทับ test plan เดิมที่มีอยู่ในสเปค — อ้างอิงและขยาย
- ❌ ห้ามลืม Security & RBAC phase — ทุกฟีเจอร์ต้องมี
- ❌ ห้ามใช้คำทั่วไปแทน domain terminology (เช่น "Document" แทน "Correspondence")
- ❌ ห้ามสร้างไฟล์นอก `specs/999-test-plan/`

## Cross-Reference

| สเปคที่เกี่ยวข้อง | ความสัมพันธ์ |
|------------------|-------------|
| `109-speckit-tester` | รัน test ตามแผนที่สร้าง — handoff ไป |
| `e2e-testing` | ใช้ Playwright patterns สำหรับ Phase 1 |
| `check-real-app` | ใช้สำหรับ browser verify จริงใน Phase 1 |
| `205-speckit-checklist` | สร้าง checklist ตรวจสอบคุณภาพ requirements (ก่อน test plan) |
| `111-speckit-validate` | validate implementation ตาม spec (หลัง test pass) |
| `verification-loop` | ลูปตรวจสอบ 6 ขั้น (build → typecheck → lint → test → security → diff) |

---

## LCBP3-DMS Context (MUST LOAD)

Before executing, load **[../_LCBP3-CONTEXT.md](../_LCBP3-CONTEXT.md)** to get:

- Canonical rule sources (AGENTS.md, specs/06-Decision-Records/, specs/05-Engineering-Guidelines/)
- Tier 1 non-negotiables (ADR-019 UUID, ADR-044 schema, ADR-016 security, ADR-002 numbering, ADR-008 BullMQ, ADR-023/043 AI boundary, ADR-007 errors)
- Domain glossary (Correspondence / RFA / Transmittal / Circulation)
- Helper script real paths
- Commit checklist
