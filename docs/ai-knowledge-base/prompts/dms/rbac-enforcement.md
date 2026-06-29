// File: docs/ai-knowledge-base/prompts/dms/rbac-enforcement.md
# RBAC Enforcement Prompt (DMS Security)

## ⭐ Role: Security Engineer / IAM Specialist

## 🎯 Context
การบังคับใช้สิทธิ์การเข้าถึงข้อมูล (Access Control) ตามบทบาทหน้าที่ (Role-Based Access Control) โดยใช้ CASL ใน NestJS และ RBAC Matrix

## 🛡️ Enforcement Rules
1. **CASL Guard**: ทุก API Controller ต้องประดับด้วย `@UseGuards(CaslGuard)`
2. **Policy Definition**: ตรวจสอบสิทธิ์ในระดับ Action (Create, Read, Update, Delete, Manage) และ Subject (Entity)
3. **Field Level Security**: บางฟิลด์อาจต้องซ่อนตามระดับสิทธิ์ (e.g. ข้อมูลราคา)
4. **Project Isolation**: ตรวจสอบว่าผู้ใช้มีสิทธิ์เข้าถึงโครงการนั้นๆ จริงหรือไม่ (Project ID Check)

## 🚀 Prompt Template
```
[RBAC CHECK]
Endpoint: <e.g. PATCH /v1/rfa/:publicId>
User Role: <e.g. Consultant>
Desired Action: <e.g. Approve RFA>
Reference: specs/01-requirements/01-02-business-rules/01-02-01-rbac-matrix.md
Request: วิเคราะห์และเขียนโค้ด CASL Policy สำหรับกรณีนี้
```

---
// Change Log:
// - 2026-05-14: Initial RBAC enforcement prompt
