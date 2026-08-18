# Agy Adapter (thin)

> 🔴 governance ทั้งหมดอยู่ที่ [`AGENTS.md`](../../AGENTS.md) + [`.devin/rules/`](../../.devin/rules/) — ห้ามคัดลอกมาไว้ที่นี่

## Load order

1. [`AGENTS.md`](../../AGENTS.md) — **LCBP3 Agent Execution Contract §1-9** บังคับใช้ทุก session
2. [`.devin/rules/README.md`](../../.devin/rules/README.md) — index กฎทั้งหมด
3. [`.devin/rules/12-key-spec-files.md`](../../.devin/rules/12-key-spec-files.md) — เลือก ADR/spec ตามงาน
4. [`memory/project-memory-override.md`](../../memory/project-memory-override.md) — project memory

## Capability notes

Agy capability แตกต่างตาม deployment — **ตรวจสอบก่อนอ้างว่าทำได้**:

| Capability                  | ถ้าไม่มี ให้ทำอย่างไร                                               |
| --------------------------- | ------------------------------------------------------------------- |
| filesystem write            | เสนอ patch/diff ให้ user apply — ห้ามอ้างว่าแก้ไฟล์แล้ว             |
| shell / test runner         | รายงาน `NOT EXECUTED — execution tool unavailable` (§5)             |
| SSH to hosts                | ห้ามเดา state ของ `np-dms-lcbp3` / ASUSTOR / QNAP — ขอให้ user ตรวจ |
| MCP (DB/Redis/Qdrant/Gitea) | ห้าม invent schema — ขอ output จาก user แทน (§2)                    |

🔴 **§5 Capability Honesty Contract มีผลบังคับเสมอ** — ไม่ว่า capability จะจำกัดแค่ไหน

## Hard limits

ตาม `AGENTS.md` §2 — ห้าม push `main`, merge PR, deploy production, destructive DB/storage op,
bypass gate, invent schema/host/API, claim verification ที่ไม่ได้ execute

## Completion report

ตาม `AGENTS.md` §8 ทุกครั้ง
