# Session — 2026-09-22 (ADR-055 Part 2 Verify + Security Audit + Upload Bug Class)

## Summary

Real-app verification ของ ADR-055 production file replace บน production สำเร็จ
(คคง.-สคฉ.3-03-21-0004-2567 → junction swap เฉพาะ rev 369, rev 359 ไม่กระทบ),
security audit พบและแก้ 3 findings (SEV-001 dual-permission confirm route,
SEV-002 symlink escape, SEV-003 upload ownership), file-picker รองรับ folder
>1,000 ไฟล์ (server-side `q` filter + cap 2,000 + wrap filenames), และแก้
upload bug class ที่ทำ `/files/upload` 400 "File is required" ทุก call site
ที่ไม่ได้ set multipart header + drawings upload ที่พัง 3 ชั้น

## ปัญหาที่พบ (Root Cause)

1. **SEV-001 (High, OWASP A01)** — `POST /files/:id/re-ocr/confirm` มีแค่
   `rag.admin.write` แต่ accept replace-mode payload → junction swap โดยไม่มี
   `correspondence.edit`. Fix: แยก `POST .../re-ocr/replace/confirm` (dual perm) +
   `confirm()` reject replace payload + `confirmReplace()` reject non-replace
2. **SEV-002** — `stageFileToTemp` เช็ค path.resolve แต่ไม่ realpath → symlink
   escape ได้. Fix: เทียบ realpath ทั้ง source และ allowed roots
3. **SEV-003** — `triggerReplace` ไม่เช็ค `uploadedByUserId` บน
   `tempAttachmentPublicId` → IDOR. Fix: owner mismatch → 403 PermissionException
4. **`[skip CI]` leak ใน 2git.sh squash body** — squash commit รวม subject ของ
   commit ย่อยใน body; commit `413791cf` (docs) มี `[skip CI]` →
   `contains(head_commit.message, '[skip CI]')` match → CI skip ทั้ง pipeline.
   Fix: empty commit retrigger (`c908b299`); **กฎ: เช็ค `git log -1 --format=%B`
   หา skip markers ก่อน/หลัง push เสมอ**
5. **FormData + apiClient default `application/json`** — axios 1.x transformRequest
   เห็น JSON content-type → `JSON.stringify(formDataToJSON(data))` → multer
   ไม่เจอ field `file` → 400 "File is required" (production log ยืนยัน 4 hits).
   พัง: replace-file-dialog upload tab, ReOcrReplacePicker, workflow-lifecycle
6. **Drawings upload-form พัง 3 ชั้น** — (a) ส่ง FormData ไป `@Body()` JSON
   endpoint → `file` field ชน `forbidNonWhitelisted` (b) `projectId` UUID ชน
   `@IsInt()` (c) service ส่ง `attachmentIds` (INT) เข้า `commit()` ที่ค้นด้วย
   `tempId` → commit no-op เงียบ
7. **staging-file preview 400 ผิด** — queue items ที่ `storageTempPath` เป็น
   bare filename (6 รายการ ไม่มี dir/extension) resolve ไป cwd → traversal guard
   block ก่อนถึง D330 recursive search (fallback unreachable)

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | ------------- |
| `backend/.../attachment-re-ocr.controller.ts` | +`POST re-ocr/replace/confirm` dual perm |
| `backend/.../attachment-re-ocr.service.ts` | confirm/confirmReplace split, ownership 403 |
| `backend/.../file-storage.service.ts` | `stageFileToTemp` realpath guard |
| `backend/.../migration.controller.ts` | `legacy-folder-files`: `q` filter ก่อน cap, cap 2,000, `{files,total,truncated}`, realpath guard |
| `backend/.../migration.service.ts` | `getStagingFileStream` — bare filename (no sep/`..`) → D330 search แทน 400 |
| `backend/.../drawing/dto/*` (5 files) | `projectId: number\|string` + `attachmentTempIds?: string[]` |
| `backend/.../drawing/*-drawing.service.ts` (3 files, 6 sites) | find by `tempId`+`isTemporary` + `commit(tempIds)` |
| `frontend/.../upload-form.tsx` | two-phase จริง: filesApi.upload → tempId → JSON DTO |
| `frontend/.../replace-file-dialog.tsx`, `ReOcrReplacePicker.tsx`, `workflow-lifecycle.tsx` | +`Content-Type: multipart/form-data` |
| `frontend/.../ReOcrDialog.tsx`, `replace-file-dialog.tsx` | max-w-4xl, split 2:3, wrap filenames, debounced filter, count/truncated hints |

## กฎที่ Lock แล้ว

- **D348** — `2git.sh` squash body รวม commit subjects → `[skip CI]` รั่วเข้า
  `head_commit.message` → CI skip เงียบ; เช็ค body ก่อน push + retrigger ด้วย
  empty commit
- **D349** — apiClient default `application/json`: **ทุก FormData POST ต้อง set
  `Content-Type: multipart/form-data` ชัดเจน** ที่ call site (axios xhr adapter
  จะลบแล้วให้ browser ใส่ boundary เอง); ห้ามแก้ที่ interceptor เพราะมี endpoints
  ที่รับ JSON แต่เคยถูกส่ง FormData
- **D350** — Drawing attachments ใช้ `attachmentTempIds` (tempId จาก
  POST /files/upload) pattern เดียวกับ correspondence; `attachmentIds` (INT)
  เป็น legacy path สำหรับ link permanent attachments เท่านั้น — commit() ค้นด้วย
  tempId เท่านั้น
- **D351** — `getStagingFileStream`: bare filename ≠ traversal — ต้องเข้า D330
  recursive search; หาไม่เจอ → 404 (ไม่ใช่ 400)

## Verification

- [x] Real-app: junction swap production จริง (rev 369→att 1035, rev 359→977 คงเดิม), audit id=1395, queue fileReplacements appended
- [x] Backend 3,211 + frontend 1,197 tests; drawing+migration 803/803
- [x] tsc + eslint + builds clean ทั้งสองฝั่ง
- [x] CI #795/796/797 deployed; #798 (upload fixes) queued
- [ ] Post-deploy verify: migration upload tab, /drawings/upload, bare-filename preview 404
