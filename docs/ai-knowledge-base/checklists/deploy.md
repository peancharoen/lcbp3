// File: docs/ai-knowledge-base/checklists/deploy.md
# Deployment Checklist

## 🛠️ Pre-Deployment (Development/Staging)
- [ ] Linting & Type Checking ผ่านหมด (`pnpm lint`, `pnpm type-check`)
- [ ] Unit Tests ผ่านทั้งหมด (`pnpm test`)
- [ ] Database Schema ถูกอัปเดตที่เซิร์ฟเวอร์เป้าหมายแล้ว (ADR-009)
- [ ] Environment Variables (Secrets) ถูกตั้งค่าใน Docker/CI แล้ว
- [ ] Build Frontend & Backend สำเร็จโดยไม่มี Error

## 🚀 Deployment Phase
- [ ] Trigger Gitea Actions / CI Pipeline
- [ ] ตรวจสอบ Container Status (Running)
- [ ] ตรวจสอบ Logs ว่าไม่มี Error Startup

## 🧪 Post-Deployment (Verification)
- [ ] ทดสอบ Login
- [ ] ทดสอบฟีเจอร์หลักที่เพิ่ง Deploy
- [ ] ตรวจสอบว่า `publicId` (UUIDv7) ทำงานถูกต้องใน URL
- [ ] เช็คความปลอดภัย (RBAC) ว่าสิทธิ์ยังถูกต้อง

## 🆘 Rollback Plan
- [ ] หากพบ Critical Bug ให้ Revert Commit ล่าสุด
- [ ] เตรียม SQL Script สำหรับ Revert Schema (ถ้ามี)

---
// Change Log:
// - 2026-05-14: Initial deployment checklist
