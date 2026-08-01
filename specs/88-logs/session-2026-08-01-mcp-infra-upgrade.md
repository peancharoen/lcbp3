# Session 2026-08-01 — MCP Infrastructure Upgrade (Feature 143)

## Summary

อัปเกรด host Node.js จาก v22.22.1 → v24.18.1 LTS และ Qdrant container จาก v1.16.1 → v1.18.1 เพื่อรองรับ MCP servers ใหม่ 5 ตัว (Redis, Qdrant, Memory, Fetch, Gitea) — ผ่าน Speckit workflow ครบ 5 ขั้น (Specify → Clarify → Plan → Tasks → Analyze) และ Implement 42/42 tasks สำเร็จด้วย zero regression

## ปัญหาที่พบ (Root Cause)

1. **Gitea MCP (`@amonstack/gitea-mcp`)** ต้องการ Node.js >=24 แต่ host รัน v22.22.1 → EBADENGINE warning
2. **Qdrant MCP (`@infoinlet/mcp-qdrant`)** client v1.18.0 incompatible กับ Qdrant server v1.16.1 → ต้องอัปเกรด Qdrant server
3. **Feature 103 (`103-node-upgrade`)** อัปเกรด Node ใน Docker containers เป็น v24.15.0 แล้ว แต่ host ยัง v22 และ `package.json` engines ยังเป็น `>=22.0.0`

## การแก้ไข (Fix)

| ไฟล์ | การเปลี่ยนแปลง |
| --- | --- |
| `backend/package.json` | engines `node` `>=22.0.0` → `>=24.0.0` (completes 103's T005) |
| `frontend/package.json` | engines `node` `>=22.0.0` → `>=24.0.0` (completes 103's T006) |
| `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/01-infrastructure/docker-compose.yml` | Qdrant image `v1.16.1` → `v1.18.1` |
| `~/.config/devin/mcp_config.json` (user-level) | เพิ่ม 5 MCP servers: redis, qdrant, memory, fetch, gitea |
| `specs/100-Infrastructures/143-mcp-infra-upgrade/` | สร้างใหม่: spec.md, plan.md, research.md, quickstart.md, tasks.md, checklists/requirements.md |

**Host-level changes (ไม่ใช่ไฟล์ใน repo):**
- ติดตั้ง Node.js v24.18.1 ผ่าน NodeSource APT (แทน v22.22.1)
- pnpm 10.33.0 ยังใช้ได้กับ Node v24
-  reinstall dependencies ทั้ง backend และ frontend (pnpm install)
- ดึง Docker image `qdrant/qdrant:v1.18.1`
-  recreate Qdrant container

## กฎที่ Lock แล้ว

- **D73**: Host Node.js = v24 LTS (v24.18.1 ณ 2026-08-01) — รองรับ MCP servers ที่ต้องการ Node >=24
- **D74**: Qdrant = v1.18.1 — รองรับ Qdrant MCP client v1.18.0; `@qdrant/js-client-rest` v1.17.0 ยัง compatible (ไม่ต้อง bump)
- **D75**: MCP servers ทั้ง 8 ตัว (3 existing + 5 new) รันผ่าน Devin CLI `mcp_config.json` — ใช้สำหรับ development workflow เท่านั้น (ไม่ใช่ production infrastructure)
- **D76**: Fetch MCP บล็อก private IP addresses (SSRF protection by design) — ใช้ `curl` ผ่าน exec หรือ MCP เฉพาะทางสำหรับ internal services

## Verification

- [x] `node --version` = v24.18.1
- [x] `npm --version` = v11.16.0
- [x] `pnpm --version` = 10.33.0
- [x] Backend tests: 891 passed, 10 skipped, 0 failed
- [x] Frontend build: 45 pages compiled successfully
- [x] AI module tests: 321 passed, 9 skipped, 0 failed
- [x] Qdrant healthz: "healthz check passed" on v1.18.1
- [x] Qdrant collection `lcbp3_vectors`: status=green, Hybrid schema (bge_dense 1024 + bge_sparse), 0 points
- [x] Gitea MCP: no EBADENGINE warning
- [x] Redis MCP: "[Redis Connected]" — พบ 26 BullMQ queue keys
- [x] Memory MCP: "Knowledge Graph MCP Server running on stdio"
- [x] Qdrant MCP: starts without compatibility error
- [x] `mcp_list_servers` ยืนยัน 8 servers live ทั้งหมด
- [x] Commit: `b71abc3c` + `1c5443d4` บน branch `143-mcp-infra-upgrade`

## Commits

- `b71abc3c` — feat(infra): upgrade host Node.js to v24.18.1 and Qdrant to v1.18.1 for MCP server support
- `1c5443d4` — docs(infra): mark all 42 tasks complete in tasks.md — 143-mcp-infra-upgrade
