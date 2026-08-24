# Agy (Antigravity IDE) Adapter (thin)

> 🔴 governance ทั้งหมดอยู่ที่ [`AGENTS.md`](../../AGENTS.md) + [`.agents/rules/`](../rules/) — ห้ามคัดลอกมาไว้ที่นี่

## Load Order

1. [`AGENTS.md`](../../AGENTS.md) — **LCBP3 Agent Execution Contract §1-9** บังคับใช้ทุก session
2. [`memory/project-memory-override.md`](../../memory/project-memory-override.md) — Project Memory อ่านก่อนเสมอเมื่อต้องการ context เดิม
3. [`.agents/rules/12-key-spec-files.md`](../rules/12-key-spec-files.md) — แผนผังการเลือก Spec/ADR ตามขอบเขตงาน
4. [`.agents/rules/`](../rules/) — กฎเฉพาะทาง (เช่น 01-UUID, 02-Security, 03-TypeScript, 15-22 MCPs)

## Agy IDE Execution Workflow

- **Planning Mode & Artifacts:**
  - สำหรับงานที่มีความซับซ้อน หรือจัดอยู่ใน Tier 1 / Tier 2 ให้วิเคราะห์และสร้าง `implementation_plan.md` ใน Artifact directory เสมอ
  - รอการยืนยันจาก User ก่อนดำเนินการแก้ไขโค้ด
  - เมื่อเสร็จสิ้น ให้สรุปผลลัพธ์ลงใน `walkthrough.md`
- **MCP Servers Integration:**
  - ใช้งาน Lazy-loaded MCP tools ทั้ง 8 ตัว (`mariadb`, `redis`, `qdrant`, `gitea`, `playwright`, `fetch`, `memory`, `StitchMCP`) ตามกฎใน `.agents/rules/15-22`
  - 🔴 ปฏิบัติตามกฎความปลอดภัยอย่างเคร่งครัด (เช่น ห้ามรัน DDL บน MariaDB, ห้ามลบ Redlock keys บน Redis, ต้องใส่ `projectPublicId` filter บน Qdrant เสมอ)

## Capability & Verification Guidelines

- **File Modifications:** ใช้ `replace_file_content` / `multi_replace_file_content` / `write_to_file` อย่างรอบคอบ ห้ามฝ่าฝืน Tier 1 CI Blockers (Zero `any`, Zero `console.log`, Valid UUIDv7)
- **Execution & Testing:** Agy มี Shell tool (`run_command`) จึงต้องรัน verification จริง ห้ามข้าม:

```bash
pnpm -C backend lint
pnpm -C backend typecheck
pnpm -C backend test
pnpm -C frontend lint
pnpm -C frontend build
```

- **Honesty Contract (§5):** หากคำสั่งใดไม่สามารถรันได้เนื่องจากติดสิทธิ์หรือ environment ให้รายงานตรงไปตรงมา (`NOT EXECUTED — ...`) ห้ามเคลมว่าผ่านการทดสอบแล้ว

## Hard Limits

ตาม `AGENTS.md` §2 — ห้าม push `main`, ห้าม merge PR โดยไม่ได้รับอนุมัติ, ห้าม deploy production, ห้ามรันคำสั่งทำลาย DB/storage, และห้าม bypass verification gates

## Completion Report

รายงานผลตามข้อกำหนด `AGENTS.md` §8 ทุกครั้ง
