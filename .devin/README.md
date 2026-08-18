# Devin Adapter (canonical rules + skills)

> 🔴 governance ทั้งหมดอยู่ที่ [`AGENTS.md`](../AGENTS.md) + [`.devin/rules/`](./rules/) — นี่คือ **canonical source**
> `.agents/rules/` และ `.agents/skills/` เป็น **deprecated duplicates** — ห้ามอ้างอิง

## Load order

1. [`../AGENTS.md`](../AGENTS.md) — **LCBP3 Agent Execution Contract §1-9** บังคับใช้ทุก session
2. [`./rules/README.md`](./rules/README.md) — index กฎทั้ง 23 ไฟล์ (**canonical**)
3. [`./rules/12-key-spec-files.md`](./rules/12-key-spec-files.md) — เลือก ADR/spec ตามงาน
4. [`../memory/project-memory-override.md`](../memory/project-memory-override.md) — project memory
5. [`./skills/README.md`](./skills/README.md) — skill index (**canonical**)

## ⚠️ Deprecated duplicates ใน `.agents/`

| Path                          | สถานะ                                             | ให้ใช้แทน                                               |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------- |
| `.agents/rules/` (25 files)   | 🔴 **DEPRECATED** — สำเนาเก่าของ `.devin/rules/`  | [`./rules/`](./rules/)                                  |
| `.agents/skills/` (124 files) | 🔴 **DEPRECATED** — สำเนาเก่าของ `.devin/skills/` | [`./skills/`](./skills/)                                |
| `.agents/adapters/`           | ✅ คงไว้ — thin adapter registry                  | [`./adapters/README.md`](../.agents/adapters/README.md) |
| `.agents/scripts/`            | ✅ คงไว้ — helper scripts                         | [`./scripts/`](../.agents/scripts/)                     |
| `.agents/workflows/`          | ✅ คงไว้ — workflow wrappers                      | [`./workflows/`](../.agents/workflows/)                 |
| `.devin/plans/`               | ✅ Devin-specific                                 | คงไว้                                                   |

🔴 **ห้ามอ่านหรืออ้างอิง `.agents/rules/` และ `.agents/skills/`** — เนื้อหา drift แล้ว
โฟลเดอร์เหล่านี้คงไว้ชั่วคราวเพื่อ audit trail — **รอ authorization จาก user ก่อนลบ**
(การลบไฟล์จำนวนมากอยู่ใน scope ที่ต้องขออนุญาตตาม `AGENTS.md` §2)

## Capability notes

- **Filesystem/shell/SSH:** มีครบ → ต้อง run verification ตาม §7 จริงทุกครั้ง
- **MCP servers:** MariaDB, Redis, Qdrant, Gitea, Playwright, fetch, memory
  → กฎอยู่ที่ `.devin/rules/15-*` ถึง `22-*`
- **Git:** ห้าม push `main` / merge PR เอง (§2)

## Completion report

ตาม `AGENTS.md` §8 ทุกครั้ง
