---
auto_execution_mode: 0
description: Resume pending multi-session work — อ่าน context เดิม, หา last checkpoint, สรุปสถานะปัจจุบัน และวางแผนต่อ โดยไม่ทำงานซ้ำ
---

# Workflow: resume-pending-work

ใช้เมื่อกลับมาทำงานที่ค้างไว้ข้าม session — เช่น งานใหญ่ที่แบ่งเป็น phase, งาน migration, หรืองานที่หยุดกลางคัน

## ขั้นตอน

### 1. อ่าน Context เดิม

ตรวจแหล่งข้อมูลเหล่านี้ตามลำดับ:

```
1. Memory system — ดู system-retrieved memories ที่เกี่ยวข้อง
2. specs/200-fullstacks/<feature>/tasks.md — ดู task status ล่าสุด
3. git log --oneline -20 — ดู commits ล่าสุด
4. progress.txt หรือ PROGRESS.md (ถ้ามี) — ดู notes ที่ทิ้งไว้
```

### 2. หา Last Checkpoint

ระบุให้ชัดว่า:
- **ทำไปถึงไหนแล้ว** — phase/task/file ที่ complete แล้ว
- **ค้างอยู่ที่ไหน** — step ที่กำลังทำอยู่ตอนหยุด
- **ยังไม่ได้ทำอะไร** — tasks ที่เหลือ

### 3. ตรวจสถานะ Build ปัจจุบัน

ก่อนทำงานต่อ ต้องรู้ว่า codebase ปัจจุบัน clean หรือไม่:

```bash
# ตรวจ TypeScript errors
pnpm --filter backend run build 2>&1 | tail -20
pnpm --filter frontend run build 2>&1 | tail -20

# ดู uncommitted changes
git status --short
git diff --stat HEAD
```

### 4. สรุปสถานะและวางแผนต่อ

ก่อนลงมือ ให้สรุปให้ผู้ใช้เห็นก่อน:

```
✅ เสร็จแล้ว:
  - Phase 1: Entity + Migration (commit abc1234)
  - Phase 2: Service layer (commit def5678)

🔄 ค้างอยู่:
  - Phase 3: Controller — เขียนครึ่งนึง, ยังไม่มี tests

⏳ ยังไม่ได้ทำ:
  - Phase 4: Frontend integration
  - Phase 5: E2E tests

🚩 Issues ที่พบ:
  - build error ที่ correspondence.service.ts:142
```

จากนั้นถามผู้ใช้ว่าต้องการ:
- ทำงานต่อจาก checkpoint เดิม
- Skip ขั้นตอนที่ค้าง (พร้อมระบุ risk)
- Re-verify งานที่ทำไปแล้วก่อน

### 5. ตรวจ NAP-DMS Specific

ก่อน resume ให้ตรวจ:
- [ ] ADR ที่เกี่ยวข้องยังไม่เปลี่ยนแปลง (ดู git log ที่ `specs/06-Decision-Records/`)
- [ ] Schema ที่ใช้อยู่ตรงกับ `lcbp3-v1.9.0-schema-02-tables.sql`
- [ ] ไม่มี merge conflict หรือ stash ค้าง

## 🚫 No Fake Resume Rule

> **ห้ามบอกว่า "ทำต่อจากตรงนี้" โดยไม่ได้อ่าน context เดิมจริง**
> ต้องระบุหลักฐานที่ชัดเจนว่า checkpoint อยู่ที่ไหน

## ✅ Mandatory Output

### Last checkpoint summary
```
- เสร็จแล้ว: [phase/commit/task]
- ค้างอยู่: [file:line หรือ task ที่หยุด]
- ยังไม่ได้ทำ: [tasks ที่เหลือ]
```

### Build status
```
✅ backend build  → clean
❌ frontend build → 2 errors (ระบุ errors)
```

### Plan ต่อ
แผน 3-5 ข้อที่จะทำในส่วนที่เหลือ พร้อม verification method

### Risks / Blockers
สิ่งที่อาจ block งาน หรือต้องระวังก่อนทำต่อ
