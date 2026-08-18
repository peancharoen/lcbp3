# CLAUDE.md — Claude Adapter (thin)

> 🔴 **นี่คือ adapter ไม่ใช่ policy** — governance ทั้งหมดอยู่ที่ [`AGENTS.md`](./AGENTS.md) + [`.devin/rules/`](./.devin/rules/)
> ห้ามคัดลอก policy มาไว้ในไฟล์นี้ (AGENTS.md §9)

## 1. โหลดกฎกลางก่อนทำงานทุกครั้ง

อ่านตามลำดับ:

1. [`AGENTS.md`](./AGENTS.md) — **LCBP3 Agent Execution Contract §1-9** (บังคับใช้ทุก session)
2. [`.devin/rules/README.md`](./.devin/rules/README.md) — index ของกฎทั้ง 23 ไฟล์
3. [`.devin/rules/12-key-spec-files.md`](./.devin/rules/12-key-spec-files.md) — ADR/spec ที่ต้องอ่านตามประเภทงาน
4. [`memory/project-memory-override.md`](./memory/project-memory-override.md) — project memory (ชนะ global memory สำหรับข้อเท็จจริง LCBP3)

โหลดกฎเฉพาะทางเพิ่มตามงาน:

| งาน                      | อ่านเพิ่ม                                                      |
| ------------------------ | -------------------------------------------------------------- |
| UUID / API response      | `.devin/rules/01-adr-019-uuid.md`                              |
| Security / auth / upload | `.devin/rules/02-security.md`                                  |
| TypeScript / file header | `.devin/rules/03-typescript.md`                                |
| Database schema          | `.devin/rules/05-forbidden-actions.md` + skill `schema-change` |
| AI / Ollama / Qdrant     | `.devin/rules/11-ai-integration.md`                            |
| Deploy                   | skill `deploy`                                                 |

## 2. Skills

Skill pack อยู่ที่ [`.devin/skills/`](./.devin/skills/) — ดู [`README.md`](./.devin/skills/README.md) สำหรับ index
ใช้ skill ผ่านการอ่าน `SKILL.md` ของ skill นั้นโดยตรง

## 3. Capability notes (Claude-specific)

- **Filesystem/shell:** ขึ้นกับ environment (Claude Code = มี; Claude.ai = ไม่มี)
- หาก **ไม่มี** shell/test-runner → บังคับใช้ **AGENTS.md §5 Capability Honesty Contract**:
  รายงาน `NOT EXECUTED — <reason>` ห้าม assume ว่า verification ผ่าน
- **MCP servers** ที่ใช้ได้ (ถ้า configure): MariaDB, Redis, Qdrant, Gitea, Playwright, fetch, memory
  → กฎการใช้อยู่ที่ `.devin/rules/15-*` ถึง `22-*`

## 4. Hard limits (ย่อจาก AGENTS.md §2 — ฉบับเต็มมีผลบังคับ)

ห้ามทำเองโดยไม่มี explicit authorization ต่อครั้ง: push `main`, merge PR, deploy production,
destructive DB/storage operation, bypass security/release gate, invent schema/host/API,
claim ว่า verification ผ่านโดยไม่ได้ execute

## 5. Completion report

ทุก implementation task ต้องรายงานตาม **AGENTS.md §8** (files changed, ADR consulted,
commands executed, verification results, architectural impact, risks, ambiguities, follow-up)
