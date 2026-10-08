# Commands & Verification

> **อ่านก่อนรัน build/test/lint** — การเดาผิดทำให้ hang หรือ fail โดยไม่จำเป็น (ย้ายมาจาก `AGENTS.md`; `AGENTS.md` เก็บเฉพาะ gotcha สำคัญ)

## Backend (`pnpm --filter backend <script>`)

| Task             | Command                            | Notes                                                               |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------- |
| Build            | `pnpm --filter backend build`      | `nest build` — ตรวจ TS compile errors                               |
| Lint (CI)        | `pnpm --filter backend lint:ci`    | ESLint with `--cache` + `--max-old-space-size=4096` — ไม่มี `--fix` |
| Lint (local fix) | `pnpm --filter backend lint`       | ESLint with `--fix` — สำหรับ local เท่านั้น                         |
| Test (single)    | `pnpm --filter backend test`       | Jest `--forceExit` — จบเอง (ไม่ใช่ watch mode)                      |
| Test coverage    | `pnpm --filter backend test:cov`   | Jest + coverage report                                              |
| Test E2E         | `pnpm --filter backend test:e2e`   | Jest e2e config (`test/jest-e2e.json`)                              |
| Test watch       | `pnpm --filter backend test:watch` | Jest watch — **จะไม่จบ** ใช้เฉพาะ interactive dev                   |

## Frontend (`pnpm --filter lcbp3-frontend <script>`)

| Task           | Command                                      | Notes                                                   |
| -------------- | -------------------------------------------- | ------------------------------------------------------- |
| Build          | `pnpm --filter lcbp3-frontend build`         | `next build --webpack`                                  |
| Lint           | `pnpm --filter lcbp3-frontend lint`          | ESLint `--max-warnings 0` (zero tolerance)              |
| Test (single!) | `pnpm --filter lcbp3-frontend test run`      | ⚠️ **ต้องมี `run`** — `vitest run` จบเอง                |
| Test coverage  | `pnpm --filter lcbp3-frontend test:coverage` | `vitest run --coverage` — จบเอง                         |
| Test (DANGER)  | `pnpm --filter lcbp3-frontend test`          | ❌ **WATCH MODE — จะ hang ไม่จบ!** อย่าใช้ใน agent loop |

## Root / Workspace

| Task         | Command             | Notes                                       |
| ------------ | ------------------- | ------------------------------------------- |
| Test all     | `pnpm -r test`      | รัน test ทุก workspace (backend + frontend) |
| Lint all     | `pnpm lint`         | ESLint ทุก workspace                        |
| Dev (both)   | `pnpm dev`          | backend + frontend พร้อมกัน (parallel)      |
| Dev backend  | `pnpm dev:backend`  | `nest start --watch`                        |
| Dev frontend | `pnpm dev:frontend` | `next dev`                                  |

## CI Pipeline (`.gitea/workflows/ci-deploy.yml`)

`pnpm install` → `pnpm --filter backend lint:ci` → security grep (`parseInt(.*uuid`, `console.log`) → `pnpm test` (backend) → `pnpm test run` (frontend) → build.

> ⚠️ CI ใช้ `pnpm test run` สำหรับ frontend (ไม่ใช่ `pnpm test`) เพื่อบังคับ single-run mode

## Git worktree gotchas (D363)

- husky pre-commit พังใน worktree → verify manual (tsc/eslint/jest) แล้ว commit `--no-verify`
- ไฟล์ใน repo มีทั้ง LF/CRLF → เช็ค `git diff --stat` ก่อน commit ทุกครั้ง กัน line-ending churn
