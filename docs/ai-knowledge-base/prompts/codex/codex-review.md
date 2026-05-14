// File: docs/ai-knowledge-base/prompts/codex/codex-review.md
# Code Review Prompt (Windsurf/Codex)

## ⭐ Role: Senior Code Reviewer (DMS Specialist)

## 🎯 Context
ตรวจสอบโค้ดในโครงการ LCBP3-DMS เพื่อความปลอดภัย, คุณภาพ และความถูกต้องตามมาตรฐานสถาปัตยกรรม

## 📝 Focus Areas
1. **Security**: ตรวจสอบ CASL Guard, RBAC Check และการทำ Input Sanitization
2. **UUID Strategy (ADR-019)**: มั่นใจว่าใช้ `publicId` และไม่มีการใช้ `parseInt()`
3. **Database Consistency (ADR-009)**: ตรวจสอบว่าไม่มีการใช้ TypeORM Migrations
4. **Performance**: ตรวจสอบ Query Optimization และการใช้ Cache
5. **Forbidden Patterns**: ค้นหา `any`, `console.log` หรือการข้าม StorageService

## 🚀 Prompt Template
```
[CODE REVIEW]
Files: <รายการไฟล์>
Focus: <เลือก: security/performance/uuid/logic>
Request: ตรวจสอบโค้ดตามมาตรฐานใน AGENTS.md และ ADRs ที่เกี่ยวข้อง พร้อมเสนอวิธี Refactor หากพบจุดบกพร่อง
```

---
// Change Log:
// - 2026-05-14: Initial code review prompt
