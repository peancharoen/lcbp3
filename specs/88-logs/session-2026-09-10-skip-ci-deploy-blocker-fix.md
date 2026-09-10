# Session 2026-09-10 (Skip CI + Deploy Blocker Fix)

## Summary

แก้ 2 ปัญหาติดต่อกัน: (1) commit `4a053028` มี `[skip CI]` ใน message body ทำให้ Gitea Actions workflow ไม่รัน (2) หลัง force-push amend แล้ว CI run #705 deploy ล้มเหลวเพราะ backend container unhealthy — TypeORM `DataTypeNotSupportedError` จาก `Attachment.classificationOverride` ที่ใช้ TS type `string | null` โดยไม่ระบุ `type: 'varchar'` ใน `@Column` decorator

## ปัญหาที่พบ (Root Cause)

### ปัญหาที่ 1: Workflow not run (commit 4a053028)

commit message body มี `[skip CI]` อยู่หลัง Co-Authored-By trailer — Gitea Actions natively honors `[skip ci]` directive และ workflow มี explicit guard `if: "!contains(github.event.head_commit.message, '[skip CI]')"` ที่บรรทัด 16 ของ `ci-deploy.yml`; `[skip CI]` ถูกเพิ่มโดยไม่ตั้งใจ — เป็น code fix commit ไม่ใช่ docs/memory commit

### ปัญหาที่ 2: Backend container unhealthy (deploy blocker)

backend crash-loop ตอน startup:
```
DataTypeNotSupportedError: Data type "Object" in "Attachment.classificationOverride" is not supported by "mariadb" database.
```

TypeORM ใช้ `reflect-metadata` infer column type จาก TypeScript type annotation — แต่ **ไม่สามารถ reflect union type** `string | null` ได้ ส่งกลับเป็น `Object` ซึ่ง MariaDB ไม่รองรับ; คอลัมน์ที่มีปัญหา 2 ตัว:
- `classificationOverride` (line 74) — `@Column({ name: 'classification_override', length: 50, nullable: true })` ไม่มี `type`
- `classificationOverrideActorUserPublicId` (line 84) — `@Column({ name: 'classification_override_actor_user_public_id', length: 36, nullable: true })` ไม่มี `type`

คอลัมน์เหล่านี้ถูกเพิ่มใน Feature 254 commits (`dd880227`, `43d91ada`)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/src/common/file-storage/entities/attachment.entity.ts` | เพิ่ม `type: 'varchar'` ใน `@Column` decorator ของ `classificationOverride` + `classificationOverrideActorUserPublicId` |

### ปัญหาที่ 1 fix

- `git commit --amend` ลบ `[skip CI]` ออกจาก commit message (hash เปลี่ยน `4a053028` → `e21871a6`)
- `git push --force-with-lease origin main` (user อนุญาต explicit สำหรับ action นี้)
- `2git.sh` ไม่รองรับ force-push กรณี commit ที่ push ไปแล้ว จึงใช้ `git push --force-with-lease` ตรงๆ (exception จากกฎ "push ใช้ 2git.sh เท่านั้น")

### ปัญหาที่ 2 fix

- เพิ่ม `type: 'varchar'` ใน `@Column` decorator ของทั้ง 2 คอลัมน์
- audit entity อื่นๆ ทั้งหมดใน backend ที่ใช้ `string | null` มี explicit `type` อยู่แล้ว — ไม่มีจุดอื่นที่ต้องแก้

## กฎที่ Lock แล้ว

### D306 — TypeORM `@Column` ต้องระบุ `type` ชัดเจนเมื่อ TS type เป็น union (`string | null`, `Date | null`)

> **เสริม D185 (2026-08-30) ที่พูดถึง refresh-token entity** — ปัญหาเดียวกันเกิดซ้ำกับ Attachment entity (Feature 254) ยืนยันว่าเป็น systemic pattern ไม่ใช่ isolated incident

TypeORM `reflect-metadata` ไม่สามารถ infer column type จาก TypeScript union type (`string | null`) ได้ — ส่งกลับ `Object` ซึ่ง MariaDB ปฏิเสธด้วย `DataTypeNotSupportedError` ตอน runtime (ไม่ติด TSC เพราะ `skipLibCheck: true`); ทุก `@Column` ที่ TS type เป็น union ต้องระบุ `type: 'varchar'`/`'datetime'`/`'text'` ชัดเจน; กฎนี้ครอบคลุมทุก entity ไม่ใช่แค่ entity ใด entity หนึ่ง

### D307 — Force-push amend เพื่อแก้ `[skip CI]` ที่ติดมาโดยไม่ตั้งใจ

`2git.sh` ไม่รองรับ force-push กรณี commit ที่ push ไปแล้ว; ถ้า commit ที่ push ไป `origin/main` แล้วมี `[skip CI]` โดยไม่ตั้งใจ (ไม่ใช่ docs/memory commit) สามารถ `git commit --amend` ลบ `[skip CI]` ออกแล้ว `git push --force-with-lease` ได้ โดยต้องได้รับ explicit user authorization ต่อครั้ง; `--force-with-lease` ปลอดภัยกว่า `--force` เพราะ abort ถ้ามีคน push ใหม่ระหว่างนั้น

## Verification

- [x] Backend build ผ่าน (`pnpm --filter backend build`)
- [x] Backend lint:ci ผ่าน (`pnpm --filter backend lint:ci`)
- [x] Commit `701e32b0` push ผ่าน `2git.sh`
- [x] CI run #706 (commit `701e32b0`) — **conclusion: success** (completed 2026-09-10 21:24:52, deploy สำเร็จ)
- [x] CI run #705 (commit `e21871a6`) confirmed failure — deploy blocker จาก entity error
- [x] CI run #707 (commit `2841e812` — RBAC fix + memory save) — status: in_progress
