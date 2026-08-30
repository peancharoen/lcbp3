# Session — 2026-08-30 (Frontend postinstall npm warnings)

## Summary

ลบ warning noise ที่เกิดจาก `npm` ถูก spawn ในสาย `postinstall` ของ frontend โดย inline node command ตรง ๆ แทน `npm run copy-monaco-assets` ทำให้ไม่มี `npm` ถูกเรียกในสาย install อีกต่อไป

## ปัญหาที่พบ (Root Cause)

โปรเจกต์เป็น **pnpm workspace** (`packageManager: pnpm@10.33.0`) แต่ `frontend/package.json` มี `postinstall: "npm run copy-monaco-assets"` เมื่อ `pnpm install` รัน postinstall → spawn `npm run copy-monaco-assets` → npm 11.19.0 อ่าน `.npmrc` และ `pnpm-workspace.yaml` แล้วเตือน config ของ pnpm ทั้งหมดที่ไม่รู้จัก:

- `prefer-workspace-packages`, `allow-unused-patches`, `store-dir`, `verify-deps-before-run`, `npm-globalconfig`, `overrides`, `_jsr-registry`, `shamefully-hoist`, `patched-dependencies` (env + global)

ทีมเดิมทน warning นี้มาตลอด (มี comment ใน `.npmrc`: *"Warnings in npm 11+ are expected and harmless"*) แต่สร้าง noise ใน log และบดบัง warning จริง ๆ

## การแก้ไข (Fix)

| ไฟล์                       | การเปลี่ยนแปลง                                                                                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/package.json` | `postinstall`: `npm run copy-monaco-assets` → inline `node -e "..."` ตรง ๆ (ตัดการ spawn `npm` ออกทั้งสาย)                                                |
| `frontend/package.json` | ข้อความ warning ใน script: "Run after npm install" → "Run after pnpm install" (สอดคล้องกับ package manager จริง)                                          |

`copy-monaco-assets` script ยังเก็บไว้สำหรับเรียกด้วย `pnpm run copy-monaco-assets` ได้ตามเดิม — เปลี่ยนเฉพาะ `postinstall` ที่เป็นจุดกำเนิด warning

## กฎที่ Lock แล้ว

- **D182 — pnpm-only install scripts:** ใน pnpm workspace ห้ามใช้ `npm run`/`npm exec` ใน `postinstall`/`prepare`/`preinstall` ให้ inline node command ตรง ๆ หรือใช้ `pnpm run`/`pnpm exec` เพื่อไม่ให้ npm ถูก spawn และอ่าน config ของ pnpm แล้วเตือน noise

## Verification

- [x] `pnpm run postinstall` รันสำเร็จ (`Monaco assets already exist`) ไม่มี warning ใด ๆ
- [x] ไม่มี `npm` ถูกเรียกในสาย postinstall อีก
- [x] Dockerfile ไม่กระทบ (ใช้ `pnpm install --frozen-lockfile --ignore-scripts` + copy Monaco เองด้วย `find` + `cp -rL` รองรับ pnpm virtual store symlinks)
- [ ] Commit + push (pending user action)
