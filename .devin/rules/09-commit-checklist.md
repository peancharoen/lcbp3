---
trigger: always_on
---

# Commit Checklist

## Commit Discipline (D264)

> **Commit local ทันทีหลังแก้ไข/อัปเดตงานแต่ละจุดเสร็จ — ห้ามปล่อยเป็น uncommitted ค้างไว้ข้ามหลายงาน**
> ดูเหตุผลเต็มที่ `memory/project-memory-override.md` D264 — uncommitted working-tree change คือจุดเสี่ยงที่เคยทำให้งานหายจริง

- **Commit (local) ทันที** — เสร็จงานย่อยแต่ละจุด (แก้ไฟล์/เพิ่ม test/อัปเดต memory) ให้ `git commit` ทันที ไม่ต้องรอ user สั่ง และไม่ต้องรอจนกว่างานทั้ง session จะเสร็จ
- **ห้าม push เอง** — push ไป `origin main` ทำได้เฉพาะเมื่อ user สั่งชัดเจนต่อครั้งเท่านั้น (hard limit, ดู AGENTS.md §Hard limits)
- **Push ใช้ `2git.sh` เท่านั้น** — ไม่ใช้ `git push` ตรงๆ สคริปต์นี้ squash commit ย่อยทั้งหมดที่นำหน้า `origin/main` เป็น 1 commit อัตโนมัติ (เก็บ commit message ย่อยไว้ใน body เป็น audit trail) ก่อน push — commit ย่อยระหว่างทางจึงไม่ทำให้ history รก

## Pre-Commit Verification

- [ ] UUID pattern verified (no parseInt on UUID)
- [ ] No `any` types in TypeScript
- [ ] No `console.log` in committed code
- [ ] Comments in Thai
- [ ] Code identifiers in English
- [ ] Schema changes via SQL directly (not migration)
- [ ] Test coverage meets targets (Backend 70%+, Business Logic 80%+)
- [ ] Relevant ADRs checked (ADR-009 → ADR-044, ADR-018, ADR-019)
- [ ] Glossary terms used correctly
- [ ] Error handling complete (Logger + HttpException)
- [ ] i18n keys used instead of hardcode text
- [ ] Cache invalidation when data modified
- [ ] Security checklist passed (OWASP Top 10)
- [ ] Dependency overrides bounded (D144 — ห้าม `>=` ลอย ๆ / `*` / `latest`; ทุก override มีขอบบน)

## Commit Message Format

```
type(scope): description

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

- `feat(correspondence): add originator organization validation`
- `fix(uuid): correct parseInt usage to string comparison`
- `spec(agents): bump to v1.8.5 - refactor structure`
