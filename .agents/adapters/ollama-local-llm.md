# Local LLM / Ollama Adapter (thin)

> 🔴 governance ทั้งหมดอยู่ที่ [`AGENTS.md`](../../AGENTS.md) + [`.devin/rules/`](../../.devin/rules/) — ห้ามคัดลอกมาไว้ที่นี่

## ⚠️ แยกให้ชัด: 2 บทบาทที่ต่างกัน

| บทบาท                                     | คำอธิบาย                                                    | ขอบเขต                                                                  |
| ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| **A. Local LLM เป็น coding agent**        | ใช้ local model (Ollama/LM Studio) ช่วยเขียนโค้ดใน repo นี้ | ต้องเคารพ `AGENTS.md` §1-9 เหมือน agent อื่น                            |
| **B. Ollama เป็น AI runtime ของระบบ DMS** | `np-dms-ai` / `np-dms-ocr` ที่ประมวลผลเอกสาร                | ต้องเคารพ **AI Boundary (§4)** — ดู `.devin/rules/11-ai-integration.md` |

**ห้ามสับสน 2 บทบาทนี้** — บทบาท B ไม่มี authority เขียน production DB/storage โดยตรงเลย

## Context budget (บทบาท A)

Local model มี context จำกัด — โหลดตามลำดับความสำคัญ แล้วหยุดเมื่อเต็ม:

| ลำดับ | ไฟล์                                                    | เหตุผล                           |
| ----- | ------------------------------------------------------- | -------------------------------- |
| 1     | `AGENTS.md` §1-9 (Execution Contract)                   | บังคับใช้ — ห้ามข้าม             |
| 2     | `.devin/rules/05-forbidden-actions.md`                  | ป้องกันความเสียหาย               |
| 3     | `.devin/rules/01-adr-019-uuid.md` + `03-typescript.md`  | Tier 1 CI blocker ที่พลาดบ่อยสุด |
| 4     | rule ไฟล์เดียวที่ตรงกับงาน (จาก `12-key-spec-files.md`) | โฟกัส                            |

❌ **ห้ามโหลด** `memory/project-memory-override.md` (131KB) ทั้งไฟล์ — grep เฉพาะส่วนที่ต้องใช้

## ข้อจำกัดที่ต้องยอมรับ (บทบาท A)

- **ห้ามทำงาน Tier 1** (security, DB schema, AI boundary, UUID strategy) แบบ autonomous
  → ให้เสนอ diff แล้วรอ human review เสมอ
- **ห้ามอ้าง ADR จากความจำ** — hallucination rate สูง ต้องอ่านไฟล์จริงทุกครั้ง (§1, §6)
- **ห้าม invent** table/column/API/host (§2) — ถ้าไม่ได้ verify ต้องบอกว่าไม่รู้
- **§5 Capability Honesty** — ถ้าไม่มี shell ให้รายงาน `NOT EXECUTED` ทุก step

## Completion report

ตาม `AGENTS.md` §8 — ถ้ารายงานไม่ครบ 8 ข้อ ถือว่างานยังไม่เสร็จ
