// File: specs/200-fullstacks/231-hermes-agent/research.md
// Change Log:
// - 2026-05-29: Phase 0 research — all unknowns resolved from ADR-031 v2.0

# Research: Hermes Agent

**Feature**: 231-hermes-agent | **Date**: 2026-05-29

---

## R-001: Hermes Stack / Runtime

**Decision**: NestJS (TypeScript) บน Node.js 22 — เช่นเดียวกับ DMS backend เพื่อ reuse tooling, tsconfig, ESLint, Jest
**Rationale**: ทีมรู้จัก NestJS ดีแล้ว; BullMQ ใช้ร่วม npm package ได้; TypeScript strict mode enforce ตาม AGENTS.md
**Alternatives considered**:
- Python FastAPI — reuse Ollama/ML code แต่ทีมหลักเป็น TypeScript/NestJS
- Go — performance ดีกว่าแต่ไม่มี BullMQ native และทีมไม่คุ้นเคย

---

## R-002: Cloud AI Provider & Model Selection

**Decision**: Claude Sonnet (orchestration) / Claude Haiku (sub-agents) เป็น primary; GPT-4o / GPT-4o-mini เป็น fallback
**Rationale**: ADR-031 v2.0 Locked Decision — Cloud AI Exception สำหรับ dev orchestration layer โดยเฉพาะ; ใช้ model ขนาดเล็กกว่าสำหรับ sub-agents เพื่อลด cost
**Alternatives considered**:
- Ollama only (Gemma4/gemma2) — ไม่ได้รับ exception จาก ADR-023A สำหรับ dev orchestration; context window จำกัด; ไม่เหมาะกับ orchestration workload ขนาดใหญ่
- GPT-4o only — ราคาสูงกว่าถ้าใช้ทุก request

---

## R-003: Dev Qdrant Isolation

**Decision**: Separate Qdrant instance บน ASUSTOR port 6334 (container: `hermes-qdrant`); collection `lcbp3_code_chunks` indexed by `repoName` + `moduleName`
**Rationale**: ADR-031 v2.0 Locked — ห้ามใช้ Qdrant instance เดียวกับ DMS document RAG (port 6333 บน QNAP ADR-023A); separation ป้องกัน cross-contamination
**Alternatives considered**:
- Shared DMS Qdrant — ปฏิเสธ: ADR-031 v2.0 explicit lock; DMS Qdrant ใช้ `projectPublicId` filter สำหรับ document isolation ซึ่งไม่เหมาะกับ code chunks

---

## R-004: BullMQ Queue Architecture

**Decision**: `hermes-notification-queue` เป็น queue หลักสำหรับ outbound Telegram; `hermes-orchestration-queue` สำหรับ async dev tasks; ใช้ Redis instance แยก (`hermes-redis` container)
**Rationale**: ADR-031 Redis Isolation Policy — ห้ามใช้ DMS production Redis (อาจ evict DMS BullMQ/lock/cache keys ถ้าใช้ `allkeys-lru`); queue names ขึ้นต้น `hermes-`
**Alternatives considered**:
- Shared DMS Redis — ปฏิเสธ: ADR-031 explicit policy; ถ้าจำเป็นต้องแชร์ต้องมี keyPrefix แยก, DB index แยก, ACL user แยก

---

## R-005: hermes_operations_log Storage

**Decision**: SQLite database ภายใน Hermes container volume (`/volume1/docker/hermes/data/ops.db`) — เริ่มต้นง่าย, ไม่ต้อง external service, เพียงพอสำหรับ DevOps audit trail
**Rationale**: ADR-031 — ต้องอยู่ใน Hermes-owned storage เท่านั้น; ไม่ใช่ DMS `audit_logs`; single-operator DevOps tool ไม่ต้องการ high-concurrency DB
**Alternatives considered**:
- Postgres volume ภายใน Hermes stack — option ถ้า ops volume เติบโต แต่ SQLite เพียงพอสำหรับ Stage 1-4
- Structured log files + ship to log collector — viable แต่ SQLite ง่ายกว่าสำหรับ query ด้วย `/status <transactionId>`

---

## R-006: SOUL.md เป็น Session Memory

**Decision**: Plain Markdown file ภายใน container volume `/volume1/docker/hermes/SOUL.md`; Hermes อ่านต้น session และ append per-session entry; rotate ทุก 30 วัน
**Rationale**: ADR-031 v2.0 Locked — ไม่ sync ลง repo ทุกกรณี; container-local เท่านั้น; ไม่ใช้ Obsidian หรือ external knowledge base
**Alternatives considered**:
- Redis-based session memory — volatile และ restart ทำให้ข้อมูลหาย
- Gitea wiki/issue — sync ลง repo ซึ่งขัดกับ ADR-031 locked decision

---

## R-007: Telegram Webhook Security

**Decision**: Verify `X-Telegram-Bot-Api-Secret-Token` header ทุก request; enforce allowlist (`HERMES_TELEGRAM_ALLOWED_USER_IDS`); Redis-based rate limit 10 req/min/user; expose webhook เฉพาะ LAN หรือผ่าน reverse proxy ที่มี TLS + Telegram secret verification
**Rationale**: ป้องกัน spoofed requests; ป้องกัน unauthorized DevOps access; ป้องกัน spam/DoS ตาม ADR-031 security requirements
**Alternatives considered**:
- IP allowlist only — ไม่เพียงพอถ้า Telegram ใช้ dynamic IPs
- No rate limiting — risk ของ spam/DoS จาก compromised Telegram account

---

## R-008: Git Identity & PR Flow

**Decision**: `hermes-bot` Gitea service account (least privilege); write token scope: create branch/issue/PR/trigger CI เท่านั้น (ไม่ใช่ admin token); branch pattern `hermes/{feat,fix,refactor}-*`; ห้าม push main/develop; ต้องผ่าน CI ก่อน merge; human approve required
**Rationale**: ADR-031 v2.0 Locked — ทุก change ผ่าน PR ที่ human review เท่านั้น; ป้องกัน accidental direct push to protected branches
**Alternatives considered**:
- Hermes push ตรง develop — ปฏิเสธ: ADR-031 explicit lock; repo gate compliance
- Admin token — ปฏิเสธ: ADR-031 explicit prohibition; least privilege principle

---

## R-009: Resource Limits บน ASUSTOR (non-Swarm Docker)

**Decision**: กำหนด fallback resource limits ทั้งใน `deploy.resources` (Swarm syntax) และ top-level `cpus`/`mem_limit` (non-Swarm syntax) เพื่อให้ enforce บน ASUSTOR ADM Docker; verify ด้วย `docker inspect` และ `docker stats`
**Rationale**: ADR-031 note — `deploy.resources` อาจถูก ignore ใน non-Swarm Docker บน ASUSTOR; ต้อง verify จาก runtime ไม่ใช่ compose file เท่านั้น
**Alternatives considered**:
- Swarm mode บน ASUSTOR — ไม่จำเป็นสำหรับ single-node DevOps tool; เพิ่ม complexity โดยไม่จำเป็น

---

## R-010: Context Loading Strategy (Selective Context)

**Decision**: Hermes โหลด context แบบ selective ตาม task type เพื่อลด token ที่ส่งไป Cloud AI: DevOps task → CONTEXT-ADR-031+AGENTS.md; DMS feature coding → +CONTEXT.md; Schema/DB → +schema SQL (read-only); Bug fix → +Dev Qdrant search results
**Rationale**: ADR-031 v2.0 — ลด cost ของ Cloud AI; ป้องกันส่ง production DB query results เข้า Cloud AI context (Data Classification Policy)
**Alternatives considered**:
- โหลด CONTEXT.md ทุก request — เพิ่ม token cost; ไม่จำเป็นสำหรับ pure DevOps queries
