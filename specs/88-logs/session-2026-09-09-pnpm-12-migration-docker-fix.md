# Session — 2026-09-09 (pnpm 12 Migration + Docker musl/patch Fix)

## Summary

Migrate pnpm 10.33.0 → 12.4.0 (Rust native binary) สำหรับทั้ง local, CI, และ Docker — แก้ Docker build failures 2 ระดับ (musl binary สำหรับ Alpine + `pnpm deploy --legacy` patch failure) — deploy สำเร็จ image `54bed0f35e1a`

## ปัญหาที่พบ (Root Cause)

### ปัญหาที่ 1: Docker pnpm binary glibc vs musl
- Docker base image = Alpine Linux (musl libc)
- pnpm 12 เป็น native binary ดาวน์โหลดจาก GitHub release
- ใช้ `pnpm-linux-x64.tar.gz` (glibc build) → `which pnpm` เจอไฟล์ แต่ execute ไม่ได้ (`/bin/sh: pnpm: not found`)
- เพราะ dynamic linker ของ glibc ไม่เข้ากับ musl

### ปัญหาที่ 2: pnpm deploy --legacy re-resolve ทำให้ patch ไม่ตรง
- `pnpm deploy --legacy` ไม่ใช้ dedicated lockfile — re-resolve dependencies ใหม่จาก registry
- `@nestjs/swagger` ใน `backend/package.json` = `^11.2.3` → lockfile ล็อค 11.2.3 แต่ re-resolve ได้ 11.4.7 (latest matching range)
- patch file สร้างไว้สำหรับ 11.2.3 → apply ไม่ได้กับ 11.4.7 → `ERR_PNPM_PATCH_FAILED`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| ---- | ------------- |
| `pnpm-workspace.yaml` | เพิ่ม `injectWorkspacePackages: true` (ใช้ dedicated lockfile deploy แทน --legacy) |
| `pnpm-workspace.yaml` | เพิ่ม `overrides: "@nestjs/swagger": "11.2.3"` (pin ให้ตรง patch) |
| `backend/Dockerfile` | เปลี่ยน `pnpm-linux-x64.tar.gz` → `pnpm-linux-x64-musl.tar.gz` (4 ตำแหน่ง) |
| `backend/Dockerfile` | ลบ `--legacy` flag จาก `pnpm deploy` |
| `frontend/Dockerfile` | เปลี่ยน `pnpm-linux-x64.tar.gz` → `pnpm-linux-x64-musl.tar.gz` (4 ตำแหน่ง) |
| `frontend/Dockerfile` | ลบ `--legacy` flag จาก `pnpm deploy` |
| `.gitea/workflows/ci-deploy.yml` | เปลี่ยน `pnpm/action-setup@v4` → `pnpm/setup@v1` (version 12.4.0, runtime node@24) |
| `package.json` | `packageManager` → `pnpm@12.4.0`, `engines.pnpm` → `>=12.0.0` |
| `backend/package.json` | `packageManager` → `pnpm@12.4.0`, `engines.pnpm` → `>=12.0.0` |
| `frontend/package.json` | `packageManager` → `pnpm@12.4.0`, `engines.pnpm` → `>=12.0.0` |
| `pnpm-workspace.yaml` | ย้าย settings จาก `.npmrc` (shamefullyHoist, publicHoistPattern, allowBuilds, minimumReleaseAge, nodeLinker, strictPeerDependencies, autoInstallPeers) |
| `README.md` | อัปเดต pnpm version 10.33.0 → 12.4.0 |
| `docs/development-setup-guide.md` | อัปเดต pnpm version |
| `docs/local-dev-setup.md` | อัปเดต pnpm version |
| `backend/src/common/processors/document-side-effects.processor.ts` | แก้ lint `no-unsafe-enum-comparison` (switch on raw string + `String(SideEffectJobType.X)`) |

## กฎที่ Lock แล้ว

- **D289**: pnpm 12 native binary ต้องเลือก archive ให้ตรง libc ของ base image — Alpine = musl (`pnpm-linux-x64-musl.tar.gz`), Debian/Ubuntu = glibc (`pnpm-linux-x64.tar.gz`)
- **D290**: pnpm deploy ใน pnpm 12 ต้องใช้ `injectWorkspacePackages: true` (dedicated lockfile) แทน `--legacy` — `--legacy` re-resolve ทำให้ patch hash ไม่ตรง
- **D291**: dependency ที่มี patch (`patchedDependencies`) ต้อง pin ใน `overrides` ด้วยเพื่อกัน re-resolve ข้ามเวอร์ชัน

## Verification

- [x] pnpm install --frozen-lockfile ผ่าน (pnpm 12.4.0)
- [x] Lockfile supply-chain verification ผ่าน (1757 entries)
- [x] @nestjs/swagger patch apply สำเร็จ (`baseUrlForSwaggerUI = normalizeRelPath(\`${finalPath}/\`)`)
- [x] Backend build ผ่าน
- [x] Frontend build ผ่าน
- [x] Backend lint:ci ผ่าน
- [x] Frontend lint ผ่าน
- [x] Backend Jest ผ่าน (2593 passed, 17 skipped)
- [x] Frontend Vitest ผ่าน (1009 passed)
- [x] Docker musl test: `pnpm --version` = 12.4.0 ใน Alpine container
- [x] `pnpm --filter backend deploy --prod --no-optional` สำเร็จ (patch apply ได้, version 11.2.3)
- [x] `pnpm --filter lcbp3-frontend deploy --prod` สำเร็จ
- [x] CI/CD deploy สำเร็จ image `54bed0f35e1a` — backend + frontend healthy

## Commits

| Hash | รายการ |
| ---- | ------ |
| `420cbcd7` | pnpm 10.33.0 → 11.26.0 |
| `1764b012` | pnpm 11.26.0 → 12.4.0 |
| `ea08dee7` | docs updated to pnpm 12.4.0 |
| `cf311a88` | CI action updated for pnpm 12 |
| `a55d734e` | enum comparison lint fix |
| `bc6276cb` | Docker direct pnpm binary download |
| `4b688426` | Docker musl archive for Alpine |
| `54bed0f3` | injectWorkspacePackages + pin swagger + ลบ --legacy |
