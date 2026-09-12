---
name: 2git-push
description: Safe manual push workflow for Gitea origin/main using the 2git.sh script. This skill documents the pre-push checks and the command to run; it does NOT invoke 2git.sh automatically.
version: 1.9.18
---

# 2git Push Workflow

> **สำคัญ:** Skill นี้ **ไม่ใช่** automation ที่จะเรียก `2git.sh` เอง ทุกครั้งต้องรอ user พิมพ์ `2git.sh` หรือขอ push อย่างชัดเจนก่อน

## When to use

- User พิมพ์ `2git.sh` หรือขอ push งานขึ้น `origin/main`
- ต้องการ squash local commits บน `main` แล้ว push ไป Gitea

## Pre-push checks (MUST)

1. **Branch guard** — ต้องอยู่บน `main`
   - `git branch --show-current` ต้องคืน `main`
   - ถ้าไม่ใช่ `main` ให้หยุดและแจ้ง user
2. **Working tree status** — ตรวจก่อน `git add`
   - `git status --short` ต้องไม่มีไฟล์ที่ไม่ต้องการ push (temp, .env, build artifacts)
   - ถ้ามีไฟล์ผิดปกติ ให้ถาม user ก่อน
3. **Verification** — ถ้างานที่กำลังจะ push เปลี่ยน code:
   - `pnpm tsc --noEmit` ผ่าน (backend + frontend)
   - `pnpm lint:ci` (backend) + `pnpm lint` (frontend) ผ่าน
   - `pnpm test` (backend) ผ่าน
   - ถ้าไม่ผ่าน ห้าม push ก่อนแก้
4. **Commit message** — บังคับใส่คำอธิบายที่มีประโยชน์
   - ตัวอย่าง: `2git.sh "feat(scope): description"`
   - ถ้า user ไม่ใส่ message ให้ถาม ไม่ใช้ default `Update` อย่างเดียว
5. **Fetch first** — ต้อง `git fetch origin main` ก่อน run `2git.sh` เพื่อป้องกัน non-fast-forward

## How to run

```bash
cd /opt/np-dms-lcbp3

# Code changes (trigger CI + deploy)
bash 2git.sh "type(scope): description"

# Docs/memory changes only (skip CI — ไม่ trigger deploy)
bash 2git.sh --skip-ci "docs(memory): description"
```

- `2git.sh` จะ `git add .`, commit (ถ้ามี), squash ทุก commit ที่นำ `origin/main`, แล้ว push
- `--skip-ci` จะ append `[skip CI]` ใน commit message → CI workflow จะข้าม (`if: "!contains(github.event.head_commit.message, '[skip CI]')"`)
- ถ้า push สำเร็จ ให้ update memory:
  - `specs/88-logs/rollouts.md` สถานะเป็น pushed
  - `memory/project-memory-override.md` หรือ session log ตามความเหมาะสม

## When to use --skip-ci

| กรณี                                    | Flag        | เหตุผล                              |
| --------------------------------------- | ----------- | ----------------------------------- |
| Code changes (backend/frontend/scripts) | (ไม่ใช้)    | ต้อง trigger CI build + deploy      |
| Docs/memory/specs only                  | `--skip-ci` | ไม่มี code changes → ไม่ต้อง deploy |
| Mixed (code + docs)                     | (ไม่ใช้)    | มี code changes → ต้อง deploy       |

## What NOT to do

- ห้ามเรียก `2git.sh` โดยอัตโนมัติโดยไม่ได้ user พิมพ์หรือสั่กชัดเจน
- ห้าม push branch อื่น ๆ ด้วย `2git.sh` (script ล็อค main)
- ห้าม `git push` ตรง ๆ แทน `2git.sh` (นอกเสียจากฉุกเฉินและได้รับ approval)
