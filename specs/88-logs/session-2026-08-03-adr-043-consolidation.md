# Session — 2026-08-03 (ADR-043 AI Architecture Consolidation)

## Summary

ย่อรวม AI-related ADRs ที่ superseded ทั้งหมด (ADR-017, 017B, 018, 020, 022) ไปยัง `archive/` และสร้าง **ADR-043: AI Architecture Current State** เป็น Single Source of Truth ที่ restatement สถาปัตยกรรม AI ปัจจุบัน (15 sections) พร้อมปิด drift ระหว่าง ADR-035 ↔ ADR-040 อย่างเป็นทางการ จากนั้น archive `03-07-OpenRAG.md` (Future Architecture Spec ล้าสมัย) และแก้ broken path links ทั้งหมด

## ปัญหาที่พบ (Root Cause)

1. **ADR sprawl** — สถาปัตยกรรม AI กระจายอยู่ใน ADR 17 ไฟล์ (017/017B/018/020/022/023/023A/024-028/030/032-037/040-042) ทำให้ developer ไม่รู้จะเริ่มอ่านที่ไหน และเกิด drift ระหว่าง ADR
2. **Stale spec** — `03-07-OpenRAG.md` (v1.8.1, 2026-03-13) อธิบายสถาปัตยกรรมเก่า (Elasticsearch + OpenRAG + n8n file-queue + Tika + nomic-embed-text) ที่ถูกแทนที่หมดแล้ว แต่ยังอยู่ใน active spec tree ทำให้คนอ่านสับสน
3. **Broken links** — หลังย้ายไฟล์ ADR ไป archive/ มี path links ใน `.devin/skills/*`, `.agents/skills/*`, `specs/README.md`, `03-07-OpenRAG.md`, `archive/ADR-018-ai-boundary.md` ที่ชี้ไป path เดิม

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `specs/06-Decision-Records/ADR-043-ai-architecture-current-state.md` | **สร้างใหม่** — ADR consolidation 1222 บรรทัด, 15 sections restating สถาปัตยกรรม AI ปัจจุบัน (model stack, sidecar contract, pipeline flows, intent classification, tool layer, chat UI, admin console, prompt management, migration, Qdrant multi-tenancy, audit logging, graceful degradation, server topology) + Decision Graph (mermaid) + "What is current" table |
| `specs/06-Decision-Records/archive/README.md` | **สร้างใหม่** — index ของ archived ADRs พร้อมเหตุผลและความสัมพันธ์กับ ADR-043 |
| `specs/06-Decision-Records/archive/ADR-017-ollama-data-migration.md` | **git mv** จาก parent dir (superseded by ADR-023 → ADR-043) |
| `specs/06-Decision-Records/archive/ADR-017B-ai-document-classification.md` | **git mv** (superseded by ADR-023 → ADR-043) |
| `specs/06-Decision-Records/archive/ADR-018-ai-boundary.md` | **git mv** + แก้ path link ภายในไฟล์ที่อ้าง 03-07-OpenRAG ให้ชี้ไป archive/ |
| `specs/06-Decision-Records/archive/ADR-020-ai-intelligence-integration.md` | **git mv** (superseded by ADR-023 → ADR-043) |
| `specs/06-Decision-Records/archive/ADR-022-retrieval-augmented-generation.md` | **git mv** (superseded by ADR-023 → ADR-043) |
| `specs/06-Decision-Records/README.md` | เพิ่ม ADR-043 ⭐ ที่หัวตาราง AI & Data Integration, แก้ path ของกลุ่ม A ให้ชี้ไป `archive/`, อัปเดต status เป็น "❌ Superseded (archived)" |
| `specs/03-Data-and-Storage/archive/03-07-OpenRAG.md` | **git mv** จาก parent dir (ล้าสมัย — ถูกแทนที่โดย ADR-043 §4) |
| `specs/03-Data-and-Storage/archive/README.md` | **สร้างใหม่** — index ของ archived specs พร้อมเปรียบเทียบสถาปัตยกรรมเก่า vs ปัจจุบัน |
| `specs/03-Data-and-Storage/README.md` | เปลี่ยน entry 03-07 ในตารางให้ชี้ไป archive พร้อม marker ❌ Archived |
| `specs/README.md` | แก้ directory tree (03-07 → archive/03-07), แก้ ADR mapping table, แก้ ADR summary table (status 5 ไฟล์ archived + เพิ่ม ADR-043 ⭐) |
| `specs/03-Data-and-Storage/03-07-OpenRAG.md` | (ย้ายแล้ว — ดู archive/03-07-OpenRAG.md) |
| `CONTEXT.md` | แก้บรรทัด OpenRAG vs ADR-023A ให้อ้าง ADR-043 เป็น Single Source of Truth + path 03-07 → archive/03-07 |
| `.devin/skills/security-review/SKILL.md` | แก้ path link ADR-018 → archive/ |
| `.devin/skills/verification-loop/SKILL.md` | แก้ path link ADR-018 → archive/ |
| `.devin/skills/nestjs-best-practices/rules/lcbp3-ai-boundary.md` | แก้ path link ADR-017/018/020 → archive/ |
| `.devin/skills/nestjs-best-practices/metadata.json` | แก้ path link ADR-018/020 → archive/ |
| `.devin/skills/nestjs-best-practices/AGENTS.md` | แก้ path link ADR-017/018/020 → archive/ (2 ตำแหน่ง) |
| `.agents/skills/*` (mirror 5 ไฟล์เดียวกับ .devin) | แก้ path link เดียวกันทั้งหมด |

## กฎที่ Lock แล้ว

- **ADR-043 = Single Source of Truth** สำหรับสถาปัตยกรรม AI ปัจจุบัน — ใช้แทนการอ่าน ADR-017/017B/018/020/022 (archived) และ ADR-023/023A/024-028/030/032-037/040-042 (active แต่กระจาย)
- **ADR numbering immutable** — เลข ADR เดิม (017/018/020/022/023/024/...) ยังใช้ได้ใน code/skills แม้ไฟล์จะถูก archive ไปแล้ว (audit trail)
- **Path links ต้อง update** เมื่อย้ายไฟล์ ADR/spec ไป archive/ — ทุก markdown link ที่อ้าง path เต็มต้องชี้ไป `archive/` ใหม่
- **Inline ADR number mentions** (เช่น "ตาม ADR-023", "ADR-040 D1") ไม่ต้องแก้ — เป็นการอ้างหมายเลขซึ่งยังคงเดิม
- **03-07-OpenRAG.md archived** — สถาปัตยกรรม RAG ปัจจุบันอยู่ใน ADR-043 §4 (Hybrid Search + Qdrant + BGE-M3 + BGE-Reranker + BullMQ) ไม่ใช่ใน 03-07

## Verification

- [x] `git status` — 5 renames (R) + 12 modified (M) + 4 new files (??) ถูกต้อง
- [x] Grep ไม่พบ broken path link ที่เหลือ (`06-Decision-Records/ADR-017-...md` นอก archive/)
- [x] Grep ไม่พบ broken path link ไป `03-Data-and-Storage/03-07-OpenRAG` นอก archive/
- [x] ทุก path link ใน ADR-043 ที่อ้าง archive files resolve ได้จริง (5/5 OK)
- [x] ทุก path link ใน ADR-043 ที่อ้าง active ADR files resolve ได้จริง (6/6 OK)
- [x] Pre-existing broken links ใน `08-Tasks/ADR-022-Retrieval-Augmented-Generation/` (อ้าง directory ที่ไม่เคยมีอยู่) — อยู่นอก scope ไม่ได้แตะ
- [ ] **Commit** — ยังไม่ได้ commit (pending user approval)
- [ ] **MCP Knowledge Graph** — บันทึก D83-D84 ลง Knowledge Graph (pending)
