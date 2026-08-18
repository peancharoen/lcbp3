# Agent Adapters

> **One governance contract, multiple thin agent adapters.**

Canonical governance อยู่ที่ [`AGENTS.md`](../../AGENTS.md) + [`.devin/rules/`](../../.devin/rules/) เท่านั้น
ไฟล์ในโฟลเดอร์นี้เป็น **adapter** — บอกวิธี load กฎกลาง + ข้อจำกัดเฉพาะ agent

## กฎของ adapter

| ✅ ใส่ได้                                         | ❌ ห้ามใส่                                                  |
| ------------------------------------------------- | ----------------------------------------------------------- |
| วิธี load `AGENTS.md` + `.devin/rules/*`          | สำเนา policy เต็มชุด                                        |
| capability / tool-specific instruction            | Forbidden Actions table (อยู่ที่ `05-forbidden-actions.md`) |
| limitation เฉพาะ agent (context budget, no shell) | ADR summary ที่จะ drift                                     |
| vendor workflow ที่จำเป็น                         | Tier enforcement / security rules                           |

## Registry

| Agent              | Adapter                                              |
| ------------------ | ---------------------------------------------------- |
| Claude             | [`../../CLAUDE.md`](../../CLAUDE.md)                 |
| Devin              | [`../../.devin/README.md`](../../.devin/README.md)   |
| Gemini             | [`../../.gemini/GEMINI.md`](../../.gemini/GEMINI.md) |
| Codex              | [`codex.md`](./codex.md)                             |
| Agy                | [`agy.md`](./agy.md)                                 |
| local LLM / Ollama | [`ollama-local-llm.md`](./ollama-local-llm.md)       |
| Windsurf Cascade   | `../../.windsurfrc` (MCP config) + IDE global memory |
| Qwen / Kilocode    | `../../.qwen/skills/`, `../../.kilocode/skills/`     |

## เพิ่ม agent ใหม่

1. สร้าง adapter file ในโฟลเดอร์นี้ (หรือที่ตำแหน่งที่ agent นั้นอ่านโดย convention)
2. ชี้ไป `AGENTS.md` §1-9 — ห้ามคัดลอก
3. เพิ่มแถวใน registry ด้านบน + ใน `AGENTS.md` §9
