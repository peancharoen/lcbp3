// File: docs/ai-knowledge-base/templates/test-case.md
# Test Case Specification

## 📋 Metadata
- **Module**: [e.g. Authentication]
- **Type**: Unit / Integration / E2E
- **Author**: [Name]

## 🧪 Test Case: [Descriptive Title]
### Objective
[อธิบายว่าต้องการทดสอบอะไร]

### Pre-conditions
1. User logged in as [Role]
2. Data [X] exists in database

### Test Steps
1. Call API `METHOD /v1/...` with data `[Y]`
2. Verify response status is `200`
3. Verify database record is updated

### Expected Result
- API return success
- Audit log is created
- No side effects on unrelated data

### Edge Cases to Cover
- Missing `Idempotency-Key`
- Unauthorized role access
- Invalid UUID format

---
// Change Log:
// - 2026-05-14: Initial test case template
