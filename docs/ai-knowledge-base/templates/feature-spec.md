// File: docs/ai-knowledge-base/templates/feature-spec.md
# Feature Specification: [Feature Name]

## 📋 Metadata
- **Status**: Draft / In Review / Approved
- **Author**: [Name]
- **Date**: [YYYY-MM-DD]
- **Module**: [e.g., Correspondence, RFA]
- **Reference**: [PRD Link / Issue ID]

## 🎯 1. Overview
[อธิบายวัตถุประสงค์สั้นๆ ของฟีเจอร์นี้ และปัญหาที่ต้องการแก้ไข]

## 📑 2. Requirements
- **Functional Requirements**:
  - [ ] Requirement 1
  - [ ] Requirement 2
- **Non-Functional Requirements**:
  - [ ] Performance: < 200ms API response
  - [ ] Security: RBAC 4-Level Check

## 🏗️ 3. Proposed Solution
### Data Model (ADR-019)
- Table: `table_name`
- Fields: `publicId (UUIDv7)`, `name`, `status`, ...

### API Endpoints
- `POST /v1/[module]/...`
- `GET /v1/[module]/:publicId`

### Workflow / Logic
[อธิบายลำดับการทำงาน หรือ Flow Chart]

## 🛡️ 4. Security & Edge Cases
- **Permissions**: ใครสามารถทำอะไรได้บ้าง?
- **Edge Cases**: จะเกิดอะไรขึ้นถ้าข้อมูลไม่ครบ? หรือส่งซ้ำ?

## ✅ 5. Acceptance Criteria
- [ ] UI แสดงผลถูกต้องตามแบบ
- [ ] API ทำงานได้ตามที่กำหนด
- [ ] Unit Test Coverage > 80%

---
// Change Log:
// - 2026-05-14: Initial template based on Hybrid Specs
