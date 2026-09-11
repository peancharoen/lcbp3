// File: .devin/skills/test-plan-generator/templates/test-plan-template.md
// Change Log:
// - 2026-09-11: Initial template for unified test plan generation

# แผนการทดสอบรวม: {FEATURE_NAME}

**วันที่ร่าง**: {DATE}
**ขอบเขต**: {SCOPE_DESCRIPTION}
**ADR อ้างอิง**: {ADR_LIST}

---

## 1. สเปคใน 200-fullstacks ที่เกี่ยวข้อง

### 1.1 Core Specs — สเปคหลักที่ implement {FEATURE_NAME} โดยตรง

| # | สเปค | ADR | หน้าที่ | สถานะ Implementation |
|---|------|-----|--------|---------------------|
| 1 | **{SPEC_ID_1}** | {ADR_1} | {PURPOSE_1} | {STATUS_1} |
| 2 | **{SPEC_ID_2}** | {ADR_2} | {PURPOSE_2} | {STATUS_2} |

### 1.2 Supporting Specs — สเปคสนับสนุนที่ {FEATURE_NAME} ใช้

| # | สเปค | ความเกี่ยวข้อง | สถานะ |
|---|------|---------------|-------|
| 1 | **{SUPPORT_SPEC_ID_1}** | {RELATION_1} | {STATUS_1} |

### 1.3 แผนภาพความสัมพันธ์ (Dependency Flow)

```
{DEPENDENCY_GRAPH}
```

---

## 2. โครงสร้างการทดสอบ

การทดสอบแบ่งเป็น **5 Phase** ตามลำดับความสำคัญและ dependency:

```
Phase 1: Browser E2E (P1)     ← ทดสอบผ่านเบราว์เซอร์จริง
  ↓
Phase 2: Backend Unit Test    ← ทดสอบ unit ที่ยังขาด
  ↓
Phase 3: Integration Test     ← ทดสอบการเชื่อมต่อระหว่าง service
  ↓
Phase 4: Performance Test     ← ทดสอบประสิทธิภาพ (SC criteria)
  ↓
Phase 5: Security & RBAC     ← ทดสอบความปลอดภัย
```

---

## 3. Phase 1: Browser E2E (P1 — ทำก่อน)

> **เป้าหมาย**: ยืนยันว่าผู้ใช้ใช้งานผ่านหน้าเว็บ {PAGE_PATH} ได้จริง

### 1A. {SUB_FEATURE_1}

**เตรียมการ**:
- [ ] Backend + Frontend deploy แล้ว (CI run ล่าสุด pass)
- [ ] {PREREQUISITES}

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1A.1 | {ACTION} | {EXPECTED_RESULT} | {FR_REF} |

### 1B. {SUB_FEATURE_2}

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1B.1 | {ACTION} | {EXPECTED_RESULT} | {FR_REF} |

### 1C. RBAC / Permission Tests ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | FR/Spec |
|---------|---------|-------------|---------|
| 1C.1 | {ROLE} พยายาม {ACTION} | {EXPECTED_RESULT} | {FR_REF} |

### 1D. Edge Cases ผ่าน Browser

| ขั้นตอน | การกระทำ | ผลที่คาดหวาง | Edge Case |
|---------|---------|-------------|-----------|
| 1D.1 | {EDGE_CASE_ACTION} | {EXPECTED_RESULT} | {EDGE_CASE_REF} |

### 1E. Console / Network Check

- [ ] DevTools Console — ไม่มี error/warning ที่เกี่ยวข้อง
- [ ] Network tab — request ไป {API_PATH} ส่งครบ parameter
- [ ] ไม่มี double-prefix bug (`/api/api/v1/...`)
- [ ] Responsive: 375px mobile + 1280px desktop ไม่มี horizontal overflow

---

## 4. Phase 2: Backend Unit Tests (P2 — ช่องว่างเร่งด่วน)

### 2A. {CONTROLLER_NAME} (Spec {SPEC_ID})

**ไฟล์**: `{TEST_FILE_PATH}` (สร้างใหม่ หรือ เติมเข้าเดิม)

| Test | Endpoint | สถานการณ์ | ผลที่คาดหวาง |
|------|----------|-----------|-------------|
| 2A.1 | {ENDPOINT} | {SCENARIO} | {EXPECTED} |

### 2B. {SERVICE_NAME} (Spec {SPEC_ID})

**ไฟล์**: `{TEST_FILE_PATH}` (เติมเข้าเดิม)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 2B.1 | {SCENARIO} | {EXPECTED} |

---

## 5. Phase 3: Integration Tests (P2)

### 3A. End-to-End {FEATURE_NAME} Flow (Spec {SPEC_IDS})

**ไฟล์**: `{TEST_FILE_PATH}` (สร้างใหม่)

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 3A.1 | {SCENARIO} | {EXPECTED} | {SPEC_REF} |

---

## 6. Phase 4: Performance Tests (P3)

### 4A. SC Criteria จาก Spec {SPEC_ID}

| Test | เกณฑ์ | วิธีวัด |
|------|-------|--------|
| 4A.1 | {CRITERIA} | {METHOD} |

---

## 7. Phase 5: Security & RBAC Tests (P2)

### 5A. CASL Guard / RBAC (Spec {SPEC_IDS})

| Test | สถานการณ์ | ผลที่คาดหวาง | Spec |
|------|-----------|-------------|------|
| 5A.1 | {ROLE} พยายาม {ACTION} | {EXPECTED} | {FR_REF} |

### 5B. UUID / ADR-019 Compliance

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5B.1 | {SCENARIO} | {EXPECTED} |

### 5C. AI Boundary (ADR-023A)

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5C.1 | {SCENARIO} | {EXPECTED} |

### 5D. Idempotency & Audit Trail

| Test | สถานการณ์ | ผลที่คาดหวาง |
|------|-----------|-------------|
| 5D.1 | {SCENARIO} | {EXPECTED} |

---

## 8. ไฟล์ทดสอบสรุป

| ไฟล์ | สถานะ | Tests เพิ่ม | Phase | Spec |
|------|-------|-----------|-------|------|
| {TEST_FILE} | {STATUS} | {COUNT} | {PHASE} | {SPEC} |

**รวม**: {TOTAL_UNIT} unit/integration tests ใหม่ + {TOTAL_E2E} ขั้นตอน browser verify

---

## 9. ลำดับการทำ (Execution Order)

```
Phase 1 (Browser E2E)          ← P1 ทำก่อน — ยืนยันใช้งานได้จริง
  ↓
Phase 2 (Backend Unit)         ← P2 ปิด coverage gap
  ↓
Phase 3 (Integration)          ← P2 ทดสอบการเชื่อมต่อ
  ↓
Phase 4 (Performance)         ← P3 benchmark
  ↓
Phase 5 (Security & RBAC)      ← P2 ความปลอดภัย
```

---

## 10. เกณฑ์ผ่าน (Acceptance Criteria)

| เกณฑ์ | เป้าหมาย | วิธีวัด |
|-------|---------|--------|
| Browser E2E | ทุกขั้นตอน Phase 1 ผ่าน | manual verify หรือ Playwright |
| {MODULE} coverage | ≥80% | `pnpm test:cov` |
| {SC_CRITERIA} | {TARGET} | {METHOD} |
| RBAC | 0 unauthorized commits | ทุก 403 ทดสอบผ่าน |
| UUID compliance | 0 INT PK exposure | API response audit |
| ไม่มี `any` / `console.log` | 0 | eslint + tsc ผ่าน |

---

## 11. ความเสี่ยงและการจัดการ

| ความเสี่ยง | ผลกระทบ | การจัดการ |
|-----------|--------|-----------|
| {RISK} | {IMPACT} | {MITIGATION} |

---

## 12. งานที่เกี่ยวข้อง (Cross-Reference)

| งาน | ความเกี่ยวข้อง | สถานะ |
|-----|-------------|-------|
| {RELATED_WORK} | {RELATION} | {STATUS} |
