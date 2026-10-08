# NAP-DMS Project Context & Rules

- For: Windsurf Cascade, Devin, Claude Code, opencode, Amp, Antigravity (AGENTS.md tools) — `CLAUDE.md` เป็น symlink มาไฟล์นี้
- Version: 1.9.20 | Last synced from repo: 2026-10-08 | Change log: [`specs/88-logs/agents-md-changelog.md`](./specs/88-logs/agents-md-changelog.md)
- Repo: [https://git.np-dms.work/np-dms/lcbp3](https://git.np-dms.work/np-dms/lcbp3)
- Canonical rules: [`.devin/rules/`](./.devin/rules/README.md) (index) | Skills: [`.devin/skills/`](./.devin/skills/README.md) (`.agents/` = deprecated mirror)

> ไฟล์นี้เป็น **quick reference** — รายละเอียดอยู่ใน rule files ตาราง "Rule Index" ด้านล่าง

---

## 📦 Project Memory

อ่าน [`memory/project-memory-override.md`](./memory/project-memory-override.md) ก่อน (decisions, environment, next focus) เมื่องานขึ้นกับบริบทเดิมของ repo — ถ้าขัดกับ global memory ให้ใช้ไฟล์นี้สำหรับ fact เฉพาะ LCBP3. หลาย conversation พร้อมกัน → [`memory/branch-workflow.md`](./memory/branch-workflow.md)

## 📜 LCBP3 Agent Execution Contract (§1–9 — บังคับใช้ทุก agent/ทุก session)

1. **§1 Source of Truth** — ขัดกันให้ยึด: Accepted ADRs > ADR amendments/superseding > Engineering Guidelines > Feature specs/Requirements > DB schema/API contracts > Implementation ปัจจุบัน; **ห้ามอ้าง ADR/schema จากความจำ — อ่านไฟล์จริง**; ห้ามแก้ conflict ด้วย assumption. Canonical: **ADR-044** (DB schema/no-migration; amends ADR-009), **ADR-041** (server placement), **ADR-045** (edge proxy)
2. **§2 Hard limits** — ห้ามโดยไม่มี explicit authorization ต่อครั้ง: push `main` (ใช้ `2git.sh` เมื่อ user สั่งเท่านั้น), merge PR, deploy production, destructive DB/storage op, bypass security/release gate · ห้าม invent table/column/API/host/config ที่ไม่ได้ verify · ฉบับเต็ม: [`05-forbidden-actions`](./.devin/rules/05-forbidden-actions.md)
3. **§3 Database** — ไม่สร้าง TypeORM migration; schema change ผ่าน schema SQL + `deltas/` ตาม ADR-044; inspect schema ก่อนเขียน query/เปลี่ยน schema
4. **§4 AI boundary** — AI/Ollama ไม่มีสิทธิ์เขียน production DB/storage ตรง (AI → DMS API → DB); ทุก AI output ต้องผ่าน human validation (ADR-023/023A/043)
5. **§5 Capability Honesty** — agent ไม่มี shell/SSH/execution หรือ network ถูกจำกัด → ยังต้องทำตาม contract เดียวกัน, รายงาน step ที่ไม่ได้รันเป็น `NOT EXECUTED — <เหตุผล>` (เช่น lint/typecheck/tests); **ห้ามอ้างว่า pass ถ้าไม่ได้ execute จริง**
6. **§6 Change discipline** — ระบุ ADR/spec/rule ที่เกี่ยวข้อง + ตรวจ implementation และ regression impact ก่อนแก้; ห้าม unrelated refactor; ห้ามเปลี่ยน public API/schema/infra ถ้าไม่ได้สั่ง
7. **§7 Verification** — ก่อนถือว่า implementation เสร็จ ให้รัน verification ทั้งหมดที่ environment รองรับ (lint, typecheck, unit/integration, targeted E2E — คำสั่งดู § Commands & Verification); ห้าม report success โดยไม่มี command/result รองรับ
8. **§8 Completion Report (ครบ 8 ข้อ)** — files changed · ADR/specs/rules consulted · commands/tests executed · verification results · architectural impact · known risks · unresolved issues/ambiguities · recommended follow-up
9. **§9 Thin adapters** — แต่ละ agent มีเฉพาะวิธี load `AGENTS.md` + `.devin/rules/` และข้อจำกัดเฉพาะตัว **ห้ามคัดลอก policy**; registry: [`.agents/adapters/README.md`](./.agents/adapters/README.md) (Claude → `CLAUDE.md`, Devin → `.devin/README.md`, Gemini, Codex, Agy, Ollama, Windsurf, Qwen/Kilocode) — เพิ่ม agent ใหม่ต้องเพิ่มแถวใน registry นั้น

---

## 🧠 Role & Working Protocol

**Senior Full Stack Developer** (NestJS, Next.js, TypeScript, DMS) — **Document Intelligence Engine** ไม่ใช่ general chatbot: ตอบ precise, spec-compliant, production-ready. Focus: Data Integrity, Security, Maintainability, Performance.

ก่อนลงมือ Tier 1–2:

1. **Analyze** — restate งาน, หา spec/ADR ที่ต้องอ่าน ([Key Spec Files](./.devin/rules/12-key-spec-files.md)), ระบุ constraints (security, UUID, terminology)
2. **Plan** — เสนอ ≥2 แนวทางถ้าทำได้ + แผนรายไฟล์ + วิธี verify
3. **Execute** — ทำตามแผน, หยุดถามเมื่อไม่แน่ใจ, สรุปให้ user เมื่อเปลี่ยน logic สำคัญ

---

## 🛡️ Critical Rules (Tier 1 — CI BLOCKER)

- **UUID (ADR-019):** ใช้ `publicId` เท่านั้น, ห้ามเปิดเผย INT `id`, ห้าม `parseInt` / `Number` / `+` บน UUID, ห้าม `id ?? ''` fallback
  - ⚠️ ESLint ban **ทุก** `parseInt()` และ unary `+` (กว้างกว่า CI grep `parseInt(.*uuid`) — ตัวเลขทั่วไป/pagination ใช้ `Number(value)` หรือ DTO/Zod `transform()`
- **RBAC (ADR-016):** API ใหม่ต้องมี CASL Guard + ตรวจ 4-Level matrix; Validation = class-validator (backend) + Zod (frontend)
- **Database:** verify schema ก่อนเขียน query (`specs/03-Data-and-Storage/lcbp3-v1.9.0-schema-02-tables.sql`); schema change = SQL delta ตาม ADR-044 (ไม่มี TypeORM migration)
- **FK Integrity:** ห้าม `repo.save(entity)` เพื่อเปลี่ยน scalar FK บน entity ที่โหลด relation มาแล้ว (relation เก่าเขียนทับ FK ใหม่) → ใช้ `repo.update()` + refetch (PR #32)
- **Concurrency (ADR-002):** เลขที่เอกสารใช้ Redis Redlock หรือ `@VersionColumn` · **Background (ADR-008):** งานนาน/แจ้งเตือนผ่าน BullMQ ห้าม inline
- **File upload (ADR-016):** Two-Phase (Temp → Commit) + ClamAV + whitelist
- **AI boundary (ADR-023/023A/041):** Ollama บน `np-dms-lcbp3` เท่านั้น, ห้ามเข้าถึง DB/storage ตรง (AI → DMS API → DB), Qdrant query ต้องมี `projectPublicId`, ทุก transition ต้องมี human `actor_user_id`
- **Errors (ADR-007):** layered classification, log technical / ส่งข้อความ user-friendly
- **Code:** strict TS, ZERO `any`, ZERO `console.log`, English identifiers + Thai comments, file header `// File: path`
- **Terminology:** Correspondence (ไม่ใช่ Letter), Workflow Engine (ไม่ใช่ Approval Flow), Document Numbering (ไม่ใช่ Document ID)

**🟡 Tier 2 (code review):** thin controller/logic ใน service, coverage 80%+ business logic / 70%+ backend, cache invalidation, naming, JSDoc/types/headers, i18n keys
**🟢 Tier 3 (specialized):** ADR-021 Workflow Context, AI infra/runtime (ADR-023/023A/024–027/032/033/036/037/040/042/043), Ingestion (ADR-028/047 — [flow](./specs/02-architecture/02-05-ai-document-ingestion-flow.md)), complex workflows, performance → ดู [`08-development-flow`](./.devin/rules/08-development-flow.md)
**🔵 Tier 4:** Prettier, comments, minor optimizations

**Out of scope (ต้องขออนุญาตก่อน):** DROP/RENAME column/table, push `main`, seed production, ลบไฟล์ถาวร, แก้ RBAC matrix/auth guard, major upgrade, แก้ Redlock, สร้าง/แก้ ADR — ดู [`05-forbidden-actions`](./.devin/rules/05-forbidden-actions.md)

---

## 📚 Rule Index (อ่านเมื่อเกี่ยวข้อง)

| หัวข้อ                   | ไฟล์ (`.devin/rules/`)                                                                                          | ใช้เมื่อ / สาระสำคัญ                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Project context & tiers  | `00-project-context.md`                                                                                         | บริบทเต็ม, platform/sub-agent command mapping                                                 |
| UUID / Security / TS     | `01-adr-019-uuid.md` · `02-security.md` · `03-typescript.md`                                                    | งานที่แตะ identifier, auth, upload, coding standard                                           |
| Terminology              | `04-domain-terminology.md` + `specs/00-overview/00-02-glossary.md`                                              | ตรวจคำศัพท์โดเมน                                                                              |
| Forbidden / Out of scope | `05-forbidden-actions.md`                                                                                       | ก่อนทำสิ่งเสี่ยง (schema, RBAC, delete, push)                                                 |
| Backend / Frontend       | `06-backend-patterns.md` · `07-frontend-patterns.md`                                                            | NestJS / Next.js patterns                                                                     |
| Dev flow (tiered)        | `08-development-flow.md`                                                                                        | 🔴 DB/API/Security → 🟡 UI/Feature → 🟢 Quick fix → 🟢 Specialized                            |
| Commit / Error / AI      | `09-commit-checklist.md` · `10-error-handling.md` · `11-ai-integration.md`                                      | pre-commit, ADR-007, ADR-023/023A                                                             |
| Specs map & triggers     | `12-key-spec-files.md` · `13-specs-folder-organization.md` · `14-context-aware-triggers.md`                     | เลือก spec/ADR ตามงาน; priority: `06-Decision-Records` > `05-Engineering-Guidelines` > others |
| MCP tools                | `15`-MariaDB · `16`-Memory · `17`-Redis · `18`-Qdrant · `19`-Gitea · `20`-Fetch · `21`-Stitch · `22`-Playwright | ก่อนใช้ MCP server นั้น (ดู ⚠️ ด้านล่าง)                                                      |
| Deps / Docker            | `23-dependency-overrides.md` · `24-docker-stack-sync.md`                                                        | แก้ override / compose                                                                        |
| Devin Cloud              | `25-devin-cloud-workflow.md`                                                                                    | agent บน Devin Cloud (fork → PR)                                                              |
| Commands & verification  | `26-commands-verification.md`                                                                                   | build/test/lint ครบ + CI order                                                                |

**MCP ⚠️:** MariaDB ❌ no DDL · Redis ❌ ห้ามลบ Redlock keys · Qdrant 🔴 ต้องมี `projectPublicId` · Gitea (`gitea` + `gitea-official`) 🔴 `merge_pull_request` ย้อนกลับไม่ได้ — confirm ก่อน; `gitea-official` ต้องส่ง `owner`+`repo` ทุกครั้ง · Stitch: code ต้อง review (ADR-019, TS strict) · Playwright คู่กับ skill `check-real-app` / `e2e-testing`

---

## 🧪 Commands & Verification (gotchas — ตารางเต็ม: [`26-commands-verification.md`](./.devin/rules/26-commands-verification.md))

- Backend: `pnpm --filter backend build` · `lint:ci` (ไม่มี `--fix`) · `test` (Jest `--forceExit`, จบเอง)
- Frontend: `pnpm --filter lcbp3-frontend build` · `lint` (`--max-warnings 0`) · **`test run`** (❌ `test` เฉยๆ = vitest watch → hang)
- Root: `pnpm -r test` · `pnpm lint` · `pnpm dev`
- CI: install → backend `lint:ci` → security grep (`parseInt(.*uuid`, `console.log`) → backend test → frontend `test run` → build

## 🐳 Docker Compose

> [!CAUTION]
> ห้าม `docker compose up -d` โดยไม่ใส่ `--env-file ../.env` (env หาย → container fail) · build backend จาก repo root

Runtime = `/opt/np-dms/<layer>/` (container รันจากที่นี่); spec canonical = `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/`. แก้ฝั่งไหนต้อง **sync อีกฝั่งทันที** (`copy-env.sh`, commit hotfix กลับ spec — D259). รายละเอียด + คำสั่ง up/start/rebuild: [`24-docker-stack-sync.md`](./.devin/rules/24-docker-stack-sync.md) · [`memory/project-memory-override.md` § Docker Compose Live Edit Protocol](./memory/project-memory-override.md)

---

## 🔀 Git & Commit Discipline

- **Commit local ทันที** หลังงานย่อยเสร็จ (D264) — ห้ามปล่อย uncommitted ค้าง; checklist เต็ม: [`09-commit-checklist.md`](./.devin/rules/09-commit-checklist.md); format `type(scope): description`
- **Push** ไป `origin main` ผ่าน `2git.sh` เท่านั้น + ต้องมี explicit authorization ต่อครั้ง — ห้าม push เอง; docs-only commit ใส่ `[skip CI]`

### ☁️ Devin Cloud (Fork → PR) — เฉพาะ agent บน Devin Cloud (`devin-bot`)

ทำงานบน fork `devin-bot/lcbp3` → branch `devin/<topic>` → เปิด PR เข้า `np-dms/lcbp3:main` (branch protection: ต้อง approval + `ci-quality`/`ci-test`) — ขั้นตอนเต็ม: [`25-devin-cloud-workflow.md`](./.devin/rules/25-devin-cloud-workflow.md)
**ห้าม:** push `upstream` / merge PR เอง · รัน `2git.sh` · แตะ GitHub mirror / `gh` · แก้ `.gitea/workflows/**`, `2git.*` · commit token · เข้า production DB/server · แก้ schema SQL/RBAC/ADR โดยไม่มีคำสั่งชัด

---

## 🧰 Agent Skills & Docs

- Issue tracker: Gitea (git.np-dms.work) → [`docs/agents/issue-tracker.md`](./docs/agents/issue-tracker.md) · labels: [`triage-labels.md`](./docs/agents/triage-labels.md) · domain docs: [`domain.md`](./docs/agents/domain.md)
- Skills (35): [`.devin/skills/README.md`](./.devin/skills/README.md) · inventory: [`docs/agents/skills-inventory.md`](./docs/agents/skills-inventory.md) · scripts: `.agents/scripts/{bash,powershell}/`
- Specs: `specs/{01-requirements,02-architecture,03-Data-and-Storage,04-Infrastructure-OPS,05-Engineering-Guidelines,06-Decision-Records}/` — index: [`specs/README.md`](./specs/README.md)

---

**To update this file:** แก้ section → เพิ่ม entry ใน [`agents-md-changelog.md`](./specs/88-logs/agents-md-changelog.md) → bump version ใน header → commit `spec(agents): bump to vX.X.X - <brief>` · เนื้อหายาว ๆ ให้เพิ่มใน `.devin/rules/` แล้วอ้างอิงที่นี่ (อย่ากลับมาขยายไฟล์นี้)
