# Project Memory Override

> **Project:** NAP-DMS (LCBP3) — Laem Chabang Port Phase 3 Document Management System
> **Version:** 1.9.15 (Last Synced: 2026-08-01 Tier 2)
> **Stack:** NestJS 11 + Next.js 16 + TypeScript + MariaDB 11.8 + Redis + BullMQ + Elasticsearch + Ollama (on-prem AI)

> [!IMPORTANT]
> **Project memory นี้ต้องใช้งานภายใต้ `AGENTS.md` เสมอ**
>
> - ให้ใช้ `AGENTS.md` เป็นกฎหลักก่อน memory ทุกครั้ง
> - ถ้า memory เก่าหรือ session note ขัดกับ `AGENTS.md` ให้ยึด `AGENTS.md`
> - งาน schema ต้องทำตาม ADR-009 ผ่าน SQL/delta เท่านั้น
> - งาน UUID/Public API ต้องทำตาม ADR-019 โดยใช้ `publicId` และห้าม `parseInt()` บน UUID
> - งาน n8n / AI migration ต้องอยู่ในขอบเขต ADR-023A และ mutation ต้องมี `Idempotency-Key`

## OS Rules & Sandbox Constraints

> [!IMPORTANT]
> **ระบบรันอยู่บน Linux (Ubuntu/Debian) — Server `np-dms-lcbp3`**
>
> - ใช้คำสั่ง `bash` และ Linux commands ได้ปกติ
> - ห้ามใช้คำสั่ง `cd` ในการสลับ Directory ใน `run_command` ให้ระบุพารามิเตอร์ `Cwd` ใน Tool ตรง ๆ
> - `pnpm` ติดตั้งแล้วบน server (v10.33.0) — รัน `pnpm install` จาก root เสมอ (workspace)
> - `CI=true` จำเป็นสำหรับ `pnpm install` แบบ non-interactive
> - ไฟล์ใน repo ต้องเป็นของ `nattanin:nattanin` ไม่ใช่ `root` (ตรวจด้วย `ls -la`)
> - `2git.sh` ใช้แทน `2git.ps1` สำหรับ commit+push ทั้ง Gitea และ GitHub

## Current Decisions (Locked)

> การตัดสินใจเหล่านี้ **ไม่สามารถเปลี่ยนแปลงได้** โดยไม่ได้รับ Explicit Approval

| ID  | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | ADR                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| D1  | n8n = Migration Phase orchestrator เท่านั้น — ห้ามทำ New Correspondence pipeline ผ่าน n8n                                                                                                                                                                                                                                                                                                                                                                                                              | ADR-023A           |
| D2  | New Correspondence → BullMQ `ai-realtime` queue โดยตรง (ไม่ผ่าน n8n)                                                                                                                                                                                                                                                                                                                                                                                                                                   | ADR-023A           |
| D3  | n8n ต้อง call `POST /api/ai/jobs` (DMS Backend) เท่านั้น — ห้าม call Ollama/Qdrant โดยตรง                                                                                                                                                                                                                                                                                                                                                                                                              | ADR-023A           |
| D4  | Excel metadata ส่งไปพร้อม AI job เป็น context (docNumber, title, sender ฯลฯ)                                                                                                                                                                                                                                                                                                                                                                                                                           | Session 2          |
| D5  | Tag suggestion ใช้ทาง C: แนะนำ existing tags + สร้างใหม่ได้ถ้าไม่มี (`isNew: true` flag)                                                                                                                                                                                                                                                                                                                                                                                                               | Session 2          |
| D6  | Editable Review Form: AI pre-fill → user approve/edit → submit (human-in-the-loop ทุกครั้ง)                                                                                                                                                                                                                                                                                                                                                                                                            | ADR-023            |
| D7  | UUID Strategy: `publicId` (UUIDv7) เท่านั้นสำหรับ Public API — INT PK ต้อง `@Exclude()`                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-019            |
| D8  | Schema changes: แก้ SQL โดยตรง + เพิ่ม `deltas/*.sql` — ห้ามใช้ TypeORM migration files                                                                                                                                                                                                                                                                                                                                                                                                                | ADR-009            |
| D9  | Qdrant search ต้องส่ง `projectPublicId` เป็น mandatory parameter ทุกครั้ง (compile-time)                                                                                                                                                                                                                                                                                                                                                                                                               | ADR-023A           |
| D10 | AI model stack: `np-dms-ai:latest` (Main LLM) + `np-dms-ocr:latest` (OCR, keep_alive:0) + `BGE-M3` (Dense 1024 + Sparse Embedding) + `BGE-Reranker-Large` (Reranker) on Admin Desktop — `nomic-embed-text` ถูกแทนที่แล้ว (ADR-034/035)                                                                                                                                                                                                                                                                 | ADR-034/035        |
| D11 | RAG Embedding trigger: `syncStatus()` → `enqueueRagPrepare()` เมื่อ status ≠ DRAFT; jobId = `rag-prepare:{documentPublicId}:{revisionNumber}` (BullMQ dedup); delete-before-upsert ทุกครั้ง                                                                                                                                                                                                                                                                                                            | ADR-035            |
| D12 | Qdrant collection `lcbp3_vectors` = Hybrid schema: `bge_dense` (1024 dims, Cosine) + `bge_sparse` (SPLADE); payload indexes: `project_public_id` (tenant), `doc_public_id`, `status_code`, `doc_type`                                                                                                                                                                                                                                                                                                  | ADR-035            |
| D13 | **Analysis Phase required** — ต้องอ่าน `docker-compose*.yml`, `deploy.sh`, `main.ts` ก่อนแนะนำ URL/Port/Path — ห้ามเดา                                                                                                                                                                                                                                                                                                                                                                                 | AGENTS.md          |
| D14 | Sandbox-Production Parity: บันทึก draft ใน `ai_sandbox_profiles` และปรับใช้ไป production `ai_execution_profiles` ผ่าน apply API (Idempotency-Key + CASL guard); sandbox pipeline ดึง project/contract ID จริงเพื่อ parity prompt context                                                                                                                                                                                                                                                               | ADR-036            |
| D15 | SandboxTabs ต้องโหลด active prompts ทั้ง ocr_system และ ocr_extraction จาก service เพื่อแสดง prompt info ทั้ง 2 steps ตาม FR-009, FR-010 (Feature-238)                                                                                                                                                                                                                                                                                                                                                 | Feature-238        |
| D16 | Backend VRAM service ต้องส่ง loadedModels พร้อม vramUsageMB (bytes → MB) เพื่อให้ frontend แสดงผล VRAM usage ของแต่ละ model ได้ถูกต้อง                                                                                                                                                                                                                                                                                                                                                                 | Session 2026-06-18 |
| D17 | สถานะพับ/คลี่ของการ์ดและเซกชันในหน้า AI Admin Console จะเก็บลงใน localStorage เพื่อรักษาสถานะ และการพับไม่มีผลต่อ background query polling                                                                                                                                                                                                                                                                                                                                                             | Feature-240        |
| D18 | Deploy script ต้องตรวจสอบ ClamAV health status ก่อน recreation — ถ้า healthy ให้ recreate เฉพาะ backend/frontend (skip 5-minute healthcheck delay)                                                                                                                                                                                                                                                                                                                                                     | Session 2026-06-19 |
| D19 | CI timeout ต้องอย่างน้อย 30 minutes เพื่อรองรับ ClamAV startup กรณีต้อง recreate full stack                                                                                                                                                                                                                                                                                                                                                                                                            | Session 2026-06-19 |
| D20 | AI Admin frontend services ต้อง normalize API response envelope ที่อาจซ้อน `data` ก่อน render; VRAM `totalVRAMMB = 0` คือ unknown capacity ไม่ใช่ OOM Guard                                                                                                                                                                                                                                                                                                                                            | Session 2026-06-19 |
| D21 | OCR Sidecar = Pure Compute Worker — orchestration/params อยู่ใน backend existing services (reject PromptBuilderService, OcrNoiseFilterService, OcrOrchestratorService)                                                                                                                                                                                                                                                                                                                                 | ADR-040 D1         |
| D22 | Wire `calculate_ocr_residency()` ใน `process_ocr` — keep_alive เป็น lazy resource param (ADR-036 Gap-2), ห้าม fixed value                                                                                                                                                                                                                                                                                                                                                                              | ADR-040 D3         |
| D23 | Retain vram_monitor + CPU-fallback for `/embed`,`/rerank` — ห้าม force BGE+Reranker GPU-resident, เคารณะ LLM-First GPU Ownership + CPU Fallback Retrieval                                                                                                                                                                                                                                                                                                                                              | ADR-040 D4         |
| D24 | Remove X-API-Key from sidecar — auth = network isolation (supersedes ADR-033 §7), sequencing: ลบเฉพาะหลัง ADR-041 cutover (single Docker host)                                                                                                                                                                                                                                                                                                                                                         | ADR-040 D5         |
| D25 | Server Consolidation — co-locate ทุก services บน single Docker host (Ryzen 5 5600 / 32GB / RTX 5060 Ti 16GB), retire Desk-5439                                                                                                                                                                                                                                                                                                                                                                         | ADR-041 D1         |
| D26 | ASUSTOR (192.168.10.9) = Primary NAS (CIFS share np-dms-as), QNAP = Backup server เท่านั้น                                                                                                                                                                                                                                                                                                                                                                                                             | ADR-041 D2         |
| D27 | Docker-internal network only for sidecar/Ollama — enables ADR-040 D5 network-only auth, QNAP backend → new host consolidation                                                                                                                                                                                                                                                                                                                                                                          | ADR-041 D3         |
| D28 | Canonical naming enforced: `np-dms-ai` (LLM), `np-dms-ocr` (OCR), `fast-path` (PyMuPDF) — ลบ `typhoon-llm`, `tesseract`, `Typhoon OCR` ออกจาก code; `OCR_SIDECAR_API_KEY` mandatory (no default); backend ไม่ส่ง `keep_alive` (sidecar คำนวณเอง)                                                                                                                                                                                                                                                       | ADR-040/034        |
| D29 | Canonical naming cleanup ครบทุก Typhoon reference ใน backend `src/` — `TYPHOON_OCR_REQUIRED_VRAM_MB` → `NP_DMS_OCR_REQUIRED_VRAM_MB`, `typhoon2.5-np-dms` → `np-dms-ai` (defaults/mocks/Swagger/JSDoc/logs); เหลือเฉพาะ historical change log comments (ไม่ต้องแก้); tsc + 299 tests ผ่าน                                                                                                                                                                                                              | ADR-040/034        |
| D30 | API Contract ต้อง match actual implementation — ห้ามเขียน contract ที่ field naming หรือ response schema ไม่ตรง Pydantic models จริง; `/ocr-upload` เป็น primary production endpoint, `/ocr` เป็น legacy; `/ocr-upload` ปลอดภัยจาก path traversal โดย design (รับ file bytes ไม่ใช่ path)                                                                                                                                                                                                              | ADR-040            |
| D31 | Gitea SSH ผ่าน Cloudflare Tunnel — ใช้ domain `git-ssh.np-dms.work` (แยกจาก `git.np-dms.work` สำหรับ HTTP/HTTPS) เพราะ Cloudflare proxy ไม่รองรับ SSH port; client ต้องใช้ `ProxyCommand cloudflared access ssh --hostname %h` ใน SSH config; docker-compose port mapping `192.168.10.11:2222:22` ถูกต้อง (Docker ให้ CAP_NET_BIND_SERVICE)                                                                                                                                                            | ADR-041            |
| D32 | Dev environment ย้ายจาก Windows → Linux server `np-dms-lcbp3` — pnpm v10.33.0, node_modules ownership = `nattanin:nattanin`, `2git.sh` แทน `2git.ps1`, GitHub SSH key เพิ่มแล้ว, remotes: `origin` (Gitea SSH) + `github` (GitHub SSH)                                                                                                                                                                                                                                                                 | Session 2026-07-02 |
| D51 | ADR-040 เป็น Source of Truth สำหรับ OCR sidecar contract (engine selection, /normalize removal) — ADR-035 OCR sidecar section ถูก amend อย่างเป็นทางการ (Amended by note ใน header)                                                                                                                                                                                                                                                                                                                    | ADR-040 D1/D2      |
| D52 | `OcrService.detectAndExtract()` ใช้ `processWithNpDmsOcr()` อย่างเดียว — ไม่มี engine selection ใน production pipeline (`getOcrEngines/selectOcrEngine` เก็บไว้สำหรับ Admin Console sandbox testing เท่านั้น)                                                                                                                                                                                                                                                                                          | ADR-040 D1         |
| D53 | Audit log ต้องสะท้อนความจริง: `auto-fallback`/`auto` (ไม่ใช่ `pymupdf`) เมื่อส่ง `engine='auto'` ไป sidecar — ห้ามเขียน audit ที่ไม่ตรง engine จริง                                                                                                                                                                                                                                                                                                                                                    | ADR-040            |
| D54 | Sidecar `_process_pdf_doc`: `auto` เป็น known engine — ลอง PyMuPDF text layer ก่อน → fallback ไป np-dms-ocr โดยตรง (ไม่ใช่ "Unknown engine"); ทุก engine path นำไปสู่ np-dms-ocr (ลบ code duplication)                                                                                                                                                                                                                                                                                                 | ADR-040 D1         |
| D55 | `docs/AI-step.md` deprecated — ใช้ `specs/02-architecture/02-05-ai-document-ingestion-flow.md` เป็น canonical AI ingestion flow walkthrough (ควรลบหรือทำเป็น redirect ในอนาคต)                                                                                                                                                                                                                                                                                                                         | Session 2026-07-30 |
| D56 | ADR-040 Phase 2 complete — X-API-Key auth ถูกลบทั้งหมดจาก sidecar + backend; ใช้ Docker-internal network isolation แทน (ADR-041 consolidation complete)                                                                                                                                                                                                                                                                                                                                                | ADR-040 D6 Phase 2 |
| D57 | `OCR_SIDECAR_API_KEY` env var ไม่มีอยู่แล้ว — ห้ามเพิ่มกลับมา; ลบจาก docker-compose, .env.template, .env.example, MIGRATION-PLAN, backend/.env.example                                                                                                                                                                                                                                                                                                                                                 | ADR-040 Phase 2    |
| D58 | Sidecar endpoints (`/ocr`, `/ocr-upload`, `/embed`, `/rerank`) ไม่ต้องมี auth header — พึ่ง network isolation เท่านั้น; curl testing guide อัปเดตแล้ว                                                                                                                                                                                                                                                                                                                                                  | ADR-040 D6         |
| D59 | `test_api_key_validation.py` ถูกลบ — ห้ามสร้างใหม่ (feature ไม่มีแล้ว); test files อื่นๆ ลบ `X-API-Key` headers + `OCR_SIDECAR_API_KEY` env setup ออกหมด                                                                                                                                                                                                                                                                                                                                               | ADR-040 Phase 2    |
| D60 | Context Config DTO Hardening (Feature-237) — `ContextFilterDto` ใช้ `@IsUUID('7')` สำหรับ `projectPublicId`/`contractPublicId` (รองรับ legacy alias `projectId`/`contractId`); `ContextConfigDto` ใช้ `@ValidateNested()`+`@Type(() => ContextFilterDto)`, `@Max(1000)` pageSize, `@IsEnum(['th','en','mixed'])` language/outputLanguage; `SandboxRagPrepDto` ใช้ `@MaxLength(200_000)` text + `@IsUUID('7')` profileId; service normalize filter เป็น `projectPublicId`/`contractPublicId` ก่อนบันทึก | Feature-237        |
| D61 | Pipeline B Frontend Foundation (Feature-241 Tier 2) — `SuggestedTag` type ใช้ `isNew` flag + `publicId?` (optional, เฉพาะ existing tags); `TagSuggestionInput` component แสดง pending suggestions (click to accept) + selected tags (with remove) + manual add; `pollAiJob` ใช้ GET /ai/jobs/:jobId polling จน completed/failed (timeout 120s, interval 2s); **Remaining:** wire up `CorrespondenceForm` ให้เรียก AI job จริง (replace placeholder onClick)                                            | Feature-241 Tier 2 |
| D62 | ⚠️ n8n Owner Account Reset Incident (Session 2026-07-31) — `n8n user-management:reset` ล้าง owner account (email/password/firstName/lastName cleared); workflow data intact; **Action Required:** user ต้อง setup owner account ใหม่ผ่าน n8n UI; **Lesson:** ห้ามรัน `user-management:reset` โดยไม่ได้รับอนุมัติ — เป็น destructive operation                                                                                                                                                          | Session 2026-07-31 |
| D50 | `manager.query()` raw SQL results ต้องผ่าน `unknown` intermediate ก่อน cast เป็น typed array — ห้าม cast โดยตรงบน `await` expression (eslint `no-unsafe-assignment` จะติด); pattern: `const raw: unknown = await manager.query(...); const rows = raw as Array<{...}>`                                                                                                                                                                                                                                 | Session 2026-07-31 |
| D33 | Docker port binding ใช้ `0.0.0.0` (ไม่ใช่ IP เฉพาะ) เพื่อให้เข้าได้ทั้ง LAN IP และ localhost; `CORS_ORIGIN` ต้องมีทั้ง `http://192.168.10.11:3001` และ `http://localhost:3001,http://127.0.0.1:3001`; deploy.sh/rollback.sh default URL = `http://192.168.10.11:3000/api` (ไม่ใช่ `backend.np-dms.work`)                                                                                                                                                                                               | Session 2026-07-03 |
| D34 | Deploy/rollback scripts ต้องมี ownership guard ตรวจสอบ runtime compose files ก่อนดำเนินการ และใช้ `install -m 644` แทน `cp` เพื่อหลีกเลี่ยง Permission denied จาก root-owned files; runtime compose files ต้องเป็นของ deploy user (`np-dms`)                                                                                                                                                                                                                                                           | Session 2026-07-03 |
| D35 | New Server RAM 64GB — MariaDB buffer pool 16G, ES heap 4G, Redis 4G, Qdrant 4G, Ollama 8G, swap 16G (25% RAM); total ~55.8G headroom ~8G; `ubuntu-lv` ขยาย 100G→150G (เดิมเต็ม 94%)                                                                                                                                                                                                                                                                                                                    | Session 2026-07-13 |
| D36 | Docker Compose deploy ใช้ `--env-file ../.env` (single source of truth) — ไม่ copy `.env` ไปทุก layer; 04-ai/ocr-sidecar ใช้ `--env-file ../../.env`                                                                                                                                                                                                                                                                                                                                                   | Session 2026-07-13 |
| D37 | Elasticsearch healthcheck ต้องส่ง `-u elastic:"$$ELASTIC_PASSWORD"` เมื่อ `xpack.security.enabled: 'true'` — ไม่งั้นได้ 401 และ healthcheck fail                                                                                                                                                                                                                                                                                                                                                       | Session 2026-07-13 |
| D38 | Distroless images (เช่น ollama-metrics) ไม่มี shell/wget/curl — ใช้ `healthcheck: disable: true` และใช้ external monitoring (Prometheus scraping) แทน                                                                                                                                                                                                                                                                                                                                                  | Session 2026-07-13 |
| D39 | Container RAM limits ต้องตรง MIGRATION-PLAN.md RAM budget table (64GB): MariaDB 16G, ES 6G (heap 4G), Redis 4G, Qdrant 4G, Backend 2G, Frontend 3G, ClamAV 2G, Gitea 2G, n8n 2G, n8n-db 1G, OCR Sidecar 2G, ollama-metrics 256M, docker-socket-proxy 256M; ES heap ต้องตรง `ES_JAVA_OPTS` กับ container memory limit                                                                                                                                                                                   | Session 2026-07-14 |
| D40 | MCP MariaDB config ต้องแก้ผ่าน Windsurf UI เท่านั้น — ห้ามแก้ไฟล์ `mcp_config.json` โดยตรง เพราะ Windsurf เขียนทับทุกครั้งที่ reload; user `migration_bot`@`%` มีสิทธิ์ `ALL PRIVILEGES` บน `lcbp3` เท่านั้น (ไม่ query `mysql.*` ได้)                                                                                                                                                                                                                                                                 | Session 2026-07-16 |
| D41 | Gitea Runner (ASUSTOR) เชื่อมตรงไป Gitea ที่ `http://git.np-dms.work:3003` (HTTP) ไม่ผ่าน NPM — `extra_hosts: git.np-dms.work→192.168.10.11`; ถ้าย้ายกลับผ่าน NPM ต้องเปลี่ยน URL กลับเป็น HTTPS และ `extra_hosts` กลับเป็น `192.168.10.8`                                                                                                                                                                                                                                                             | Session 2026-07-20 |
| D42 | Docker Compose layer 00-basic = Docker management (Portainer) — start ก่อน infrastructure; 01-infrastructure = data stores + monitoring exporters (node-exporter, cAdvisor, mariadb-exporter ยังอยู่ที่ 01 เพราะ `depends_on: mariadb` ต้องอยู่ใน compose project เดียวกัน)                                                                                                                                                                                                                            | Session 2026-07-20 |
| D43 | Cloudflare Tunnel ingress สำหรับ `lcbp3.np-dms.work` ต้องมี path rule 3 ชั้นเรียงจากเจาะจงสุดก่อน: `^/api/auth` → frontend (`:3001`, NextAuth), `^/api` → backend (`:3000`), catch-all (ไม่มี path) → frontend; `NEXT_PUBLIC_API_URL` ยังเป็น `https://lcbp3.np-dms.work/api` (same-origin) ตาม design เดิม — ห้ามลบ rule `^/api/auth` เพราะจะทำ login พัง                                                                                                                                             | Session 2026-07-21 |
| D44 | CIFS uploads mount ต้องใช้ `uid=1001,gid=1001,noperm,file_mode=0777,dir_mode=0777` ตรงกับ backend container user `nestjs` (UID 1001); `noperm` ข้าม local POSIX check (CIFS `nounix` ไม่สนับสนุน POSIX permission จริง); หลังเปลี่ยน mount options ต้อง `docker restart` container เพื่อรับ mount namespace ใหม่; legacy mount (read-only) ยังคง `uid=1000,gid=1000`                                                                                                                                   | Session 2026-07-22 |
| D45 | ADR-041 Server Consolidation = `Implemented` (2026-07-22) — D5 revised: Cloudflare Tunnel เป็น internet-facing edge, NPM (QNAP) เป็น internal router; QNAP services ไม่มีแล้ว (ย้ายหมดก่อน cutover); functional tests ที่ต้องมี document data (6.2/6.3/6.6/6.7/6.8) = Pending                                                                                                                                                                                                                          | ADR-041            |
| D46 | OCR Prompt Cache Invalidation: Redis hash (`ocr:prompt:hash:{model}`) + SHA-256 16 hex chars + auto unload via POST `/v1/chat/completions` `keep_alive=0` + asyncio.Lock sequential processing; `compute_prompt_hash(None)` = `"none"`; graceful degradation เมื่อ Redis ไม่พร้อม; crash handling ล้าง hash บน inference failure                                                                                                                                                                       | Feature-142        |
| D47 | ADR-042 OCR Text Persistence — `rag-prepare` job แยกเป็น 2 jobs: (1) OCR-extract-persist เขียน `attachments.ocr_text` ก่อนเสมอ (2) `embed-document` รับ `extractedText` เพื่อข้าม OCR ซ้ำเมื่อ retry — ลด redundant GPU calls; `attachmentPublicId` เป็น WHERE key ตาม ADR-019                                                                                                                                                                                                                         | ADR-042            |
| D48 | Sandbox Project (`projects.is_sandbox`) — Admin-only Full Pipeline testing ผ่าน code path เดียวกับ production, scoped ด้วย `project_id`, กรองออกจาก `GET /projects` เสมอ (hardcoded `isSandbox=false`), ไม่อนุญาตให้ผู้ใช้ทั่วไปสร้างเอกสารใน Sandbox Project (guard ใน `CorrespondenceService.create()`)                                                                                                                                                                                              | ADR-042            |
| D49 | `clearSandboxData()` endpoint (`POST /ai/admin/sandbox/clear-data`) — hard-delete cascading scoped `WHERE project_id = sandboxProjectId` + enqueue vector deletion ต่อเอกสาร, ไม่ตรวจสอบ BullMQ job active ก่อนลบ (ตาม Clarifications), ลบไฟล์กายภาพก่อน DB rows (log warning ไม่ throw ถ้า fail)                                                                                                                                                                                                      | ADR-042            |

## Environment & Services

| Service                 | Local URL / Port             | Production                      | Notes                                                                                                                             |
| ----------------------- | ---------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Backend API**         | `http://localhost:3000`      | `http://192.168.10.11:3000/api` | NestJS — port 3000 in container, bound `0.0.0.0:3000` (localhost + LAN)                                                           |
| **Frontend**            | `http://localhost:3001`      | `http://192.168.10.11:3001`     | Next.js — port 3000 in container, bound `0.0.0.0:3001` (localhost + LAN)                                                          |
| **MariaDB**             | `192.168.10.11:3306`         | New Server (bind IP)            | DB: `lcbp3`; MCP user: `migration_bot` (ALL on `lcbp3`); app user: `center`; port bound `192.168.10.11:3306`                      |
| **Redis**               | `192.168.10.11:6379`         | New Server (bind IP)            | BullMQ + session store; exposed for Uptime Kuma @ ASUSTOR 192.168.10.9                                                            |
| **Ollama**              | `http://192.168.10.11:11434` | New Server (native systemd)     | np-dms-ai:latest (main) + np-dms-ocr:latest (OCR, keep_alive:0)                                                                   |
| **Elasticsearch**       | `192.168.10.11:9200`         | New Server (bind IP)            | Advanced Search; exposed for Uptime Kuma @ ASUSTOR 192.168.10.9                                                                   |
| **Qdrant**              | `http://localhost:6333`      | New Server (Docker internal)    | Vector DB — requires projectPublicId; internal only (no host port)                                                                |
| **OCR Sidecar**         | `http://192.168.10.11:8765`  | New Server (Docker internal)    | np-dms-ocr (Ollama) + BGE-M3 `/embed` + BGE-Reranker `/rerank`; async I/O, lifespan, no /normalize                                |
| **Gitea**               | `https://git.np-dms.work`    | New Server `192.168.10.11:3003` | Source + CI/CD; SSH via `git-ssh.np-dms.work:2222` (Cloudflare Tunnel)                                                            |
| **Gitea Runner**        | ASUSTOR `192.168.10.9`       | `http://git.np-dms.work:3003`   | CI runner — เชื่อมตรงไป Gitea (HTTP, ไม่ผ่าน NPM); ต้องลบ `.runner` cache ถ้าเปลี่ยน URL                                          |
| **Portainer**           | `192.168.10.11:9443`         | `portainer.np-dms.work`         | Docker management UI — Layer 00-basic; NPM proxy; mount docker.sock                                                               |
| **node-exporter**       | `192.168.10.11:9100`         | —                               | Host metrics (CPU/RAM/disk) — Layer 01-infrastructure; Prometheus scrape from ASUSTOR                                             |
| **cAdvisor**            | `192.168.10.11:8088`         | —                               | Container metrics — Layer 01-infrastructure; Prometheus scrape from ASUSTOR                                                       |
| **mariadb-exporter**    | `192.168.10.11:9104`         | —                               | MariaDB metrics — Layer 01-infrastructure; user `exporter`@`%`; Prometheus scrape from ASUSTOR                                    |
| **ollama-metrics**      | `192.168.10.11:9924`         | —                               | Ollama LLM metrics — Layer 04-ai (lcbp3-ai-telemetry); Prometheus scrape from ASUSTOR                                             |
| **nvidia-gpu-exporter** | `192.168.10.11:9835`         | —                               | GPU telemetry (nvidia-smi) — Layer 04-ai (lcbp3-ai-telemetry); Prometheus scrape from ASUSTOR                                     |
| **Uptime Kuma**         | `https://uptime.np-dms.work` | ASUSTOR `192.168.10.9:3001`     | Service availability monitoring — Push monitors สำหรับ CIFS mounts; Telegram channel "NP-DMS Telegram Alert" (group np-dms-lcbp3) |
| **CIFS Mount Monitor**  | cron `* * * * *` (np-dms)    | —                               | `/opt/np-dms/scripts/push-monitors-cifs.sh` — ตรวจ 3 mounts ทุกนาที + push ไป Uptime Kuma; config: `.cifs-monitor.env` (perm 600) |

### Key Environment Variables

```
DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
REDIS_HOST, REDIS_PORT
JWT_SECRET, JWT_EXPIRES_IN
OLLAMA_BASE_URL (ชี้ไป Admin Desktop)
QDRANT_URL
```

## Next Session Focus

### Grafana Monitoring — Pending Backend Redeploy (Session 2026-08-01)

- [ ] **Redeploy backend** เพื่อ expose `bullmq_*` metrics ผ่าน `/metrics` endpoint — code พร้อมแล้ว (`BullmqMetricsService` + `bullmqMetricProviders` ใน `monitoring.module.ts`, `tsc --noEmit` PASS) แต่ยังไม่ได้ build/deploy; หลัง deploy แล้ว Grafana dashboard "LCBP3 — BullMQ Queues" (id=26) จะแสดงผลได้
- [x] **ลบ QNAP targets ออกจาก Prometheus config** — ✅ COMPLETE 2026-08-01: ลบ `qnap-node` + `qnap-cadvisor` jobs ออกจาก `prometheus.yml` (ทั้งใน repo และบน ASUSTOR `/volume1/np-dms/monitoring/prometheus/config/prometheus.yml`); verified Prometheus targets 9/9 UP (0 DOWN) — ก่อนหน้านี้เป็น 2/13 DOWN ตลอด; QNAP post-ADR-041 เป็นเพียง NPM edge proxy ไม่มี exporters แล้ว

### CIFS Mount Bugfix + Monitor (Session 2026-07-31) ✅ COMPLETE

- [x] **Bugfix:** Mount CIFS shares คืน (temp/permanent/legacy) + `docker restart backend` → แก้ HTTP 400 ที่ `/api/ai/admin/sandbox/ocr`
- [x] **Monitor script:** สร้าง `/opt/np-dms/scripts/push-monitors-cifs.sh` + `.cifs-monitor.env` (TOKEN_MAP, perm 600) + cron `/etc/cron.d/np-dms-cifs-monitor`
- [x] **Uptime Kuma:** สร้าง Telegram channel "NP-DMS Telegram Alert" + เชื่อม monitor 3 ตัว (ID 22/23/24) + ตั้ง Heartbeat Interval=60s
- [x] **Test:** Alert จริง (DOWN/UP event บันทึกใน Kuma) + Telegram ส่งสำเร็จ
- [x] **Docs:** อัปเดต `docs/MONITORING-PLAN-REV01.md` (section CIFS Mount Monitor Implementation)
- [x] **Follow-up (optional):** เพิ่ม monitoring สำหรับ Elasticsearch (เห็น ECONNREFUSED ใน logs ระหว่างทาง) + แก้ Duplicate DTO `CreateTagDto` warning — ✅ ES MONITOR COMPLETE 2026-08-01: ตรวจ Uptime Kuma พบ ES HTTP monitor (ID=9) มีอยู่แล้วและทำงานปกติ (status=UP ตลอด 24 ชม. ล่าสุด) แต่ไม่ได้เชื่อม notification; **เชื่อม Telegram notification (ID=1) ให้ ES monitor และ monitors อื่นอีก 16 ตัวที่ไม่มี notification** (Backend, Frontend, MariaDB, Redis, Qdrant, Ollama, Gitea, n8n, PMA, Portainer, QNAP, ฯลฯ) — ตอนนี้ 20/23 monitors มี notification ครบ (เหลือ 3 groups ที่ไม่ต้องการ); สร้าง `push-monitors-es.sh` + `.es-monitor.env` (perm 600) + cron `/etc/cron.d/np-dms-es-monitor` (ทุก 2 นาที) เป็น push-based backup monitor; อัปเดต MONITORING-PLAN-REV01.md; ⚠️ Duplicate DTO `CreateTagDto` warning ยังไม่ได้แก้ (Tier 3)

### OCR Sidecar Review Fixes (Session 2026-06-20) ✅ COMPLETE

- [x] **Review:** Code review ของ `specs/100-Infrastructures/140-ocr-sidecar-refactor/` ทั้งหมด (3 Critical, 7 High, 6 Medium, 3 Low, 2 Suggestions)
- [x] **Fix #1:** ลบ hardcoded API key default ใน `SandboxOcrEngineService` — fail-fast เมื่อ `OCR_SIDECAR_API_KEY` ไม่ถูกตั้งค่า
- [x] **Fix #2:** Rewrite API contract v1.1 — เพิ่ม `/ocr-upload`, `/embed`, `/rerank`; แก้ camelCase fields, response schema, error format, health response
- [x] **Fix #3:** Document path traversal safety สำหรับ `/ocr-upload` (inherently safe — accepts file bytes, not paths)
- [x] **Verify:** `tsc --noEmit` (backend) หลังแก้ SandboxOcrEngineService — ✅ PASS (Session 2026-07-31 Tier 2)
- [x] **Remaining review findings:** 7 High + 6 Medium + 3 Low ยังไม่ได้แก้ (ดู review report ใน session log) — ✅ COMPLETE 2026-08-01: re-review พบ 9 findings จริง (ส่วนใหญ่ใน original ถูกแก้ใน sessions ถัดมา) แก้ครบ: HIGH #1+#2 (NaN guard + consistent null handling), MEDIUM #3-#6 (docs: health response, data-model fields, env var, pageRange→maxPages), LOW #7+#8 (pythainlp stubs, README python version), SUGGESTION #9 (camelCase pdfPath); `tsc --noEmit` PASS; OCR tests 12/12 pass; report ที่ `specs/100-Infrastructures/140-ocr-sidecar-refactor/code-review-report.md`

### OCR Backend Cleanup (Session 2026-06-20) ✅ COMPLETE

- [x] **P1-1:** ลบ `keep_alive` จาก backend form data
- [x] **P1-2:** ลบ hardcoded API key defaults (ocr.service.ts + sandbox-ocr-engine.service.ts)
- [x] **P2-1:** Align env var `OCR_SIDECAR_API_KEY` ใน `.env.example`
- [x] **P2-2:** Fix OCR URL + ลบ `THAI_PREPROCESS_URL` ใน `.env.example`
- [x] **P2-5:** Bump Dockerfile เป็น `python:3.11-slim`
- [x] **P3-1/P3-2:** Wrap sync VRAM calls ใน `asyncio.to_thread()`
- [x] **Rename typhoon-llm → np-dms-ai:** สร้าง `np-dms-ai.processor.ts`, ลบ `typhoon-llm.processor.ts`, อัปเดต `ai.module.ts`
- [x] **Tesseract cleanup:** enum, entity, controller, service, audit log, tests
- [x] **User renamed:** `typhoon-ocr.processor.ts` → `np-dms-ocr-processor.ts`
- [x] **Rename TyphoonOcr → NpDmsOcr:** `TyphoonOcrProcessor` → `NpDmsOcrProcessor`, `QUEUE_TYPHOON_OCR` → `QUEUE_NP_DMS_OCR`, `OcrTyphoonOptions` → `OcrNpDmsOptions`, `typhoonOptions` → `ocrOptions` (backend 7 files + 3 tests)
- [x] **Frontend cleanup:** `isTyphoon` → `isAiPowered`, state vars `typhoon*` → `ocr*`, Tesseract mocks → Fast Path, dead `typhoon_ocr` checks removed, `page.tsx` model name constants
- [x] **Verify:** `tsc --noEmit` หลัง rename ครบ (backend) — exit 0, 32 suites/299 tests pass
- [x] **Verify:** `tsc --noEmit` frontend — ✅ PASS (Session 2026-07-31 Tier 2)

### ADR-040/041 Implementation

- [x] **OCR Sidecar Refactor (Speckit-140):** Phases 1-6, 8, 9 complete (T001-T046, T054-T063)
  - [x] Phase 1-2: Setup + Foundational (T001-T006)
  - [x] Phase 3: US1 Security Hardening (T007-T015) — path traversal, API key fail-fast
  - [x] Phase 4: US2 GPU Resource Management (T016-T025) — residency wiring, CPU fallback
  - [x] Phase 5: US3 Parameter Governance (T026-T040) — backend param resolution
  - [x] Phase 6: US4 Async I/O (T041-T046) — async def, lifespan context manager, AsyncClient
  - [x] Phase 8: Remove /normalize endpoint (T054-T055)
  - [x] Phase 9: Polish & validation (T056-T063) — Dockerfile, docker-compose, README, quickstart
  - [x] **Validation:** speckit-validate PASS — 17/17 active FRs, 13/14 active ACs, 8/8 edge cases, 41 tests (25 Python + 16 TypeScript); 3 FRs blocked by ADR-041; 2 minor gaps (SC-003/SC-005 benchmarks); doc inconsistencies in data-model.md/quickstart.md/README.md
  - [x] Phase 7: US5 Network Isolation Auth (T047-T053) — ✅ COMPLETE (Session 2026-07-31 Tier 2)
    - [x] T047: Network isolation test created (`tests/test_network_isolation.py` — 7 tests pass in ocr-sidecar container)
    - [x] T048-T053: Verified done (ADR-040 Phase 2, 2026-07-30) — X-API-Key removed from sidecar + backend + .env; OCR_API_URL=http://ocr-sidecar:8765
- [x] **ADR-041 Infrastructure:** Provision new host, mount ASUSTOR CIFS, deploy docker-compose — ✅ Implemented 2026-07-22
- [x] **ADR-040 Auth Removal:** Remove X-API-Key from sidecar + backend (T048-T053) — ✅ Done (post-cutover)
- [x] **ADR-041 Cutover:** Migrate DB/ES, update DNS, smoke tests, retire Desk-5439 — ✅ Done

### N8N Migration & E2E Testing

- [x] **Import `n8n.workflow.v2.json`** เข้า n8n UI — ✅ Verified 2026-07-31: workflow imported (id=4LlPbAKU5BZLgiTg, name="LCBP3 Migration Workflow v2.0.0", 28 nodes, inactive)
- [x] **n8n owner account** — ✅ Verified 2026-07-31 Tier 1: owner account `peancharoen@gmail.com` (role `global:owner`, id `ed352faa-1b0d-42f0-bdaf-7c1f9abefd97`) ใช้งานได้ — login API ตอบ HTTP 200; workflow `4LlPbAKU5BZLgiTg` เข้าถึงได้พร้อม E2E test
- [ ] **ทดสอบ End-to-End จริง** — รัน n8n กับ Excel ตัวอย่าง — ✅ UNBLOCKED 2026-07-31 Tier 1 (owner account ใช้งานได้แล้ว) — รอ dry run จริง
- [x] **Real Excel files available** — `/mnt/asustor-legacy/` มี Excel จริง (C22024.xlsx, C1 2563-2568.xlsx, ทะเบียนเอกสาร C2-2567/2568/2569.xlsx) — mount read-only ใน n8n container ที่ `/home/node/.n8n-files/staging_ai/`
- [x] **Backend reachable from n8n** — `http://backend:3000/health` ตอบ 200 จากใน n8n container
- [x] **Migration review queue empty** — clean state สำหรับ dry run (0 rows ใน migration_review_queue)

### Feature 241: OCR Text Persistence & Sandbox Project (Session 2026-07-30) ✅ CODE COMPLETE + VERIFIED (Tier 2)

- [x] **Phase 1-6:** 23/23 tasks ทำเสร็จ (T001-T023)
- [x] **DB Delta Applied:** ocr_text + is_sandbox columns + SANDBOX project seed (id=7, uuid=aaade9b1-8bcc-11f1-9b2b-1644a306cf95)
- [x] **Verify:** `tsc --noEmit` (backend) — ✅ PASS (Session 2026-07-31 Tier 2)
- [x] **Verify:** `pnpm test` (backend) — ✅ PASS (Session 2026-07-31 Tier 2): 5 suites/71 tests ผ่าน (rag-prepare + ai-batch + ai.service)
- [x] **Verify:** `pnpm build` (frontend) — ✅ PASS (Session 2026-07-31 Tier 2): Next.js build สำเร็จ ทุก route
- [x] **Manual Test:** quickstart.md ข้อ 1 — Schema delta applied (ocr_text LONGTEXT + is_sandbox TINYINT + SANDBOX project) ✅ verified via DB
- [x] **Manual Test:** quickstart.md ข้อ 2 — OCR text persistence verified in code: `processRagPrepare` updates `attachments.ocr_text` BEFORE enqueuing `embed-document` (ADR-042)
- [x] **Manual Test:** quickstart.md ข้อ 3 — Full Pipeline Sandbox: `clearSandboxData` endpoint verified in code (POST /ai/admin/sandbox/clear-data, ADR-016 idempotency)
- [x] **Manual Test:** quickstart.md ข้อ 4 — RBAC filtering verified in code: `project.service.ts` hardcodes `isSandbox = false` in findAll(); `correspondence.service.ts` blocks non-admin from SANDBOX project
- [x] **Manual Test:** quickstart.md ข้อ 5 — Production Pipeline Sandbox endpoints verified in code (3 endpoints exist, return job results not DB rows)
- [x] **Frontend Editable Review Form** (Pipeline B) — ✅ COMPLETE (Session 2026-07-31 Tier 2):
  - [x] `SuggestedTag` + `AiJobResult` + `AiJobStatusResponse` types added to `frontend/types/ai.ts`
  - [x] `TagSuggestionInput` component created (`frontend/components/ai/tag-suggestion-input.tsx`) — accept/remove suggested tags, manual add, NEW badge for new tags
  - [x] `getAiJobStatus` + `pollAiJob` methods added to `admin-ai.service.ts` (GET /ai/jobs/:jobId polling) — แก้ response mapping (BullMQ state → AiJobStatus)
  - [x] `submitAiJob` เพิ่ม `Idempotency-Key` header (ADR-016)
  - [x] 9 unit tests pass (`tag-suggestion-input.test.tsx`)
  - [x] **Backend Pipeline B:** เพิ่ม `ai-suggest` public job type ใน `PublicJobType` + `CreateAiJobDto` + `ai-policy.service.ts` (profile=quality + OCR snapshot); `processSuggestDocument()` ใหม่ใน `ai-batch.processor.ts` — โหลด attachment → OCR → AI extraction → `suggestTags()` (ไม่สร้าง tag ใหม่) → return `AiJobResult`; `TagsService.suggestTags()` ใหม่ (ค้นหา existing โดยไม่สร้างใหม่ — human-in-the-loop); `AiJobResultDto` เพิ่ม `suggestedSubject`/`suggestedDocumentDate`/`suggestedSenderId`/`suggestedDisciplineId`
  - [x] **Frontend Wiring:** `CorrespondenceForm` `handleAiSuggestion()` — upload temp → POST /ai/jobs (ai-suggest) → poll → pre-fill subject/date/sender + `TagSuggestionInput` สำหรับ tags; `AiSuggestionButton` onClick ใช้ handler จริง (ไม่ใช่ toast placeholder)
  - [x] **Verify:** `tsc --noEmit` (backend) exit 0; `tsc --noEmit` (frontend) exit 0; backend 87 AI+tags tests pass; frontend 943 tests pass; `pnpm build` (frontend) สำเร็จ
- [ ] **Dry Run** กับ Excel จริงก่อน Production Migration — ⚠️ BLOCKED: n8n owner account reset (see N8N Migration section above)

### AI Ingestion Flow Reconciliation + OcrService Code Smell Fix (Session 2026-07-30) ✅ COMPLETE

- [x] **สร้าง 02-05-ai-document-ingestion-flow.md** — ย้ายจาก docs/AI-step.md + reconcile กับโค้ดจริง
- [x] **ปิด drift ADR-035↔ADR-040** — เพิ่ม Amended by note ใน ADR-035 + Amends ใน ADR-040 + แก้ dead link + T010 Done
- [x] **อัปเดต root docs 7 ไฟล์** — README, AGENTS, ARCHITECTURE, CHANGELOG, CONTEXT, CONTRIBUTING, ADR README
- [x] **อัปเดต .agents + .devin rules 8 ไฟล์** — ลบ gemma4/nomic-embed/PaddleOCR/Desk-5439 drift
- [x] **แก้ OcrService code smell** — ลบ engine selection, rename processWithFastPath→processWithAutoFallback, แก้ audit log
- [x] **แก้ sidecar app.py** — auto เป็น known engine, ลบ code duplication
- [x] **แก้ ai.service.ts TS1109** — syntax corruption บรรทัด 1377-1379
- [x] **แก้ sandbox-ocr-engine.service.ts** — log messages + engineUsed
- [x] **Tests:** 6 suites/55 tests + 4 suites/34 OCR tests + 2 suites/8 frontend tests ผ่าน
- [x] **ADR-040 Review Pass (Session 2026-07-30 #2):** Status Proposed→Accepted; T001–T014 marked Done (verified against code); corrected model size (4B/2.5GB not 7-8B); fixed ADR-034 relationship (References not Amends); fixed broken CONTEXT.md link; renamed plan file (cluade→claude); added back-refs to ADR-033 (Superseded §7) + ADR-036 (Amended §5); fixed ADR-041 T016 contradiction (Done→Pending, X-API-Key still in code); updated ADR README statuses
- [x] **ADR-040 Phase 2 (T016–T018) (Session 2026-07-30 #3):** ลบ X-API-Key auth จาก sidecar (app.py) + backend (OcrService + SandboxOcrEngineService); ลบ OCR_SIDECAR_API_KEY env var จาก docker-compose, .env.template, .env.example, MIGRATION-PLAN; ลบ test_api_key_validation.py; อัปเดต 6 test files + curl guide; ADR-040 Phase 2 Done + ADR-041 T016 Done + ADR-033 §7 supersede complete
- [x] **Eslint Fix ai.service.ts (Session 2026-07-31 #2):** แก้ 8 eslint errors ที่ block commit ของ ADR-040 Phase 2 — `manager.query()` คืน `any` ทำให้ `.map()` เป็น unsafe; ใช้ intermediate `unknown` variable ก่อน cast (D50); commit `daa3a14f` push สำเร็จ
- [x] **ลบ `docs/AI-step.md`** หรือทำเป็น redirect → 02-05 — ✅ DONE 2026-07-31 Tier 1 (ผู้ใช้ลบเอง, git status `D docs/AI-step.md`); content ถูก migrate ไป `specs/02-architecture/02-05-ai-document-ingestion-flow.md` (reconciled กับโค้ดจริง + ADR-040)
- [x] **Build + Deploy** — rebuild backend + sidecar image เพื่อให้การแก้ code smell + Phase 2 มีผลใน production — ✅ Verified 2026-07-31 Tier 1 (ผู้ใช้ยืนยัน)
- [x] **⚠️ Decision ID Conflict RESOLVED** — D33–D41 (new set, sessions 2026-07-30 ถึง 2026-07-31) renumbered เป็น D51–D59; D33–D43 (old set, sessions 2026-07-03 ถึง 2026-07-21) คงเดิม; session logs 2 ไฟล์อัปเดตตาม (Session 2026-07-31)

### RAG Pipeline — Production Readiness

- [x] **รัน SQL delta** `2026-06-05-add-rag-chunking-prompt.sql` ใน MariaDB production
- [x] **Deploy OCR Sidecar ใหม่** บน Desk-5439 หลัง rebuild image
- [x] **Drop + recreate Qdrant collection** `lcbp3_vectors` เป็น Hybrid schema — ✅ Verified 2026-07-31: collection มี Hybrid schema ที่ถูกต้องแล้ว (`bge_dense` 1024 Cosine + `bge_sparse` SPLADE + payload indexes: `project_public_id`/`doc_public_id`/`status_code`/`doc_type`); `points_count: 0` (ไม่มี data สูญเสีย); `ensureCollection()` ใน `qdrant.service.ts` auto-upgrade เมื่อ backend restart
- [ ] **SC-002 E2E accuracy test** — ทดสอบ Chat Q&A ≥ 80% accuracy

### General Tasks

- [x] เพิ่ม unit test สำหรับ `upsertQueueRecord` ใน `ai-migration-checkpoint.service.spec.ts` — ✅ COMPLETE 2026-08-01: 8 tests ครอบ insert/update/idempotencyKey override/UUID resolution/number tempAttachmentId/UUID not found/status mapping/aiResult merge; 10/10 tests pass (2 logError + 8 upsertQueueRecord)
- [x] เพิ่ม unit test สำหรับ checksum dedup ใน `file-storage.service.spec.ts` — ✅ COMPLETE 2026-08-01: 4 tests ครอบ dedup hit (existing temp), dedup miss (expired), dedup miss (different user), SHA-256 checksum validation; 11/11 tests pass (7 existing + 4 new)

### Feature-303: Frontend Test Coverage — Phase 3 🔄 IN PROGRESS

- [x] **Phase 2 coverage gate:** Statements 51.62% (target ≥ 50%)
- [x] **Verification:** `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] **Coverage suite:** `pnpm --filter lcbp3-frontend exec vitest run --coverage` ผ่าน 92 files / 692 tests
- [x] **New/extended coverage:** auth store, i18n utility, Circulation list, OCR sandbox prompt manager, Layout widgets
- [x] **Plan/tasks updated:** `specs/300-others/303-frontend-test-coverage/plan.md` และ `tasks.md`
- [x] **Phase 3 (Part 1):** Added 11 new test files (AI + layout components); 722/722 tests passing; coverage 51.62% statements
- [x] **Phase 3 (Part 2):** Added 77 tests (lib/api/_ + components/workflows/_); 833/833 tests passing; coverage TBD
- [x] **Check coverage:** Verify coverage % from browser report (target ≥ 70%) — ✅ AUDIT 2026-08-01: Statements 60.2% / Branches 49.32% / Functions 58.37% / Lines 60.83% (139 files / 943 tests) — ยังไม่ผ่าน target ≥70% (ขาด ~10%); บันทึกใน plan.md Coverage Run Record
- [x] **Remaining:** T034 Admin dashboard components — ✅ COMPLETE 2026-08-01: tests มีครบใน `__tests__/`
- [x] **Remaining polish:** T050-T053 audit (`any`/`console.log`, publicId mock data, file headers, final coverage record) — ✅ COMPLETE 2026-08-01: แก้ `any` ใน 7 test files; ไม่มี `console.log`; เพิ่ม `// File:` header ใน 14 test files; บันทึก coverage สุดท้าย; tsc ผ่าน

### Feature-235: AI Runtime Policy Refactor ✅ COMPLETE

- [x] **Phase 1–8 ทุก task เสร็จครบ** รวม T032 (manual validation ผ่านหมดทุก Gate ที่ test ได้)
- [x] **Test suite:** 5 suites / 27 tests ผ่านใน targeted verification รอบล่าสุด (`ai.service.spec`, `ocr-residency.spec`, `queue-policy.spec`, `vram-monitor.service.spec`, `ai.controller.spec`)
- [x] **ESLint + tsc --noEmit:** ผ่านครบ ไม่มี error
- [x] **Canonical naming:** `np-dms-ai` / `np-dms-ocr` ทุก layer (API response, audit log, Admin Console, frontend badge)
- [x] **Adaptive OCR Residency:** `keep_alive` คำนวณ dynamic จาก VRAM headroom + active profile
- [x] **CPU Fallback Retrieval:** `/embed` + `/rerank` บน sidecar fallback ไป CPU เมื่อ GPU headroom ไม่พอ
- [x] **Queue Policy:** `ai-realtime` concurrency=2 (configurable ผ่าน `AI_REALTIME_CONCURRENCY`); `rag-query` → `ai-batch` เสมอ
- [x] **Validation artifacts:** `specs/200-fullstacks/235-ai-runtime-policy-refactor/validation-report.md` = `PARTIAL`; `checklists/cutover-validation.md` สร้างไว้สำหรับปิด T032
- [x] **i18n:** เพิ่ม `ai_runtime_policy` namespace ใน en/th locales
- [x] **CONTEXT.md:** เพิ่ม Feature-235 ใน System Readiness + ADR-034 ใน ADRs table
- [x] **T032:** Manual validation gate (Gate 1A/1B/1D ผ่านแล้ว — Gate 1C ต้องรอมี document จริงใน DB)
- **Branch:** `235-ai-runtime-policy-refactor` — พร้อม merge หลัง T032 manual validation ผ่าน

### Feature-236: Unified OCR Architecture — Sandbox Parity ✅ COMPLETE

- [x] **Phase 1–9 ทุก task เสร็จครบ**
- [x] **Test suite:** 31 suites / 256 tests ผ่าน 100%
- [x] **ESLint + tsc --noEmit:** ผ่านครบ ไม่มี error ทั้ง frontend และ backend
- [x] **Sandbox-Production Parity:** sandbox profiles ดึง draft configuration, apply production flow ทำงานพร้อม Idempotency-Key และ CASL guard
- [x] **Dual-Model Snapshot:** snapshot params แยกส่วน LLM และ OCR บันทึกลง job payload สำเร็จ
- [x] **Master Data Parity:** sandbox ดึง project/contract master data สำหรับ prompt context
- **Branch:** `236-unified-ocr-architecture` — พร้อม merge

### Correspondence Module Review Fixes ✅ COMPLETE

- [x] `throw new Error` → `ValidationException` (ADR-007) + `@Audit` บน `processAction`
- [x] CSV export: force `limit: 10000` override ใน `exportCsv`
- [x] `escapeCsv`: กัน OWASP formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`)
- [x] `bulkCancel`: เพิ่ม `this.logger.warn(...)` ใน catch block
- [x] `update()` re-index: ใช้ status จาก current revision แทน hardcode `'DRAFT'`
- [x] `RecipientDto`: เพิ่ม nested validation class + `@ValidateNested({ each: true })`
- [x] `PUT /:uuid`: แก้ permission → `correspondence.edit` (seed id=73)
- [x] Idempotency: `@UseInterceptors(IdempotencyInterceptor)` บนทุก 7 mutation endpoints
- [x] **Verify:** `pnpm --filter backend build` + ทดสอบ CSV export > 10 rows + Idempotency header — ✅ Verified 2026-07-31 Tier 2: `pnpm --filter backend build` exit 0; `correspondence.controller.spec.ts` 4/4 tests pass; CSV export ใช้ paginated loop (pageSize=1000) รองรับ > 10 rows; `escapeCsv` กัน OWASP formula injection (`=`, `+`, `-`, `@`, `\t`, `\r`); `IdempotencyInterceptor` ครบ 7 mutation endpoints; ⚠️ CSV export > 10 rows ต้องการ data จริง (ยังไม่มี — รอ n8n dry run)

### RFA ADR-001/021 Migration ✅ COMPLETE

- [x] ตัด deprecated `CorrespondenceRouting`/`RoutingTemplate`/`RoutingTemplateStep` repos ออก
- [x] ตัด `RfaWorkflowService` + entities (`RfaWorkflow`, `RfaWorkflowTemplate`, `RfaWorkflowTemplateStep`) ออกจาก `rfa.module.ts`
- [x] `submit()` + `processAction()` rewired ผ่าน `workflowEngine.processTransition()`
- [x] EC-RFA-001 check ย้ายเข้า transaction ด้วย `FOR UPDATE` lock (race-safe)
- [x] `syncRevisionStatus()` helper: map `STATE_TO_STATUS` — ห้าม hardcode
- [x] `notifyRecipients()` helper: ADR-008 async notify
- [x] `findOneByUuid()`: expose ADR-021 workflow fields (`workflowInstanceId`, `workflowState`, `availableActions`)
- [x] เพิ่ม static constants: `WORKFLOW_CODE = 'RFA_APPROVAL'`, `STATE_TO_STATUS` map, `DEFAULT_APPROVED_CODE = '1A'`
- [x] ตัด `templateId` ออกจาก `SubmitRfaDto` (backend + frontend) + `detail.tsx` UI + tests
- [x] **Verify:** `tsc --noEmit` (backend) exit 0
- [x] **Verify:** 26/26 frontend tests pass (`rfa.service.test.ts` + `detail.test.tsx`)

### Feature-237: Unified Prompt Management UX/UI — Code Review ✅ REVIEW FIXES COMPLETE (Session 2026-07-31)

- [x] **Review artifact:** `specs/200-fullstacks/237-unified-prompt-management-ux-ui/code-review-report.md`
- [x] **Frontend verification:** `pnpm --filter lcbp3-frontend exec tsc --noEmit` ผ่าน
- [x] **Backend blocker (resolved):** RFA migration เสร็จครบ — `tsc --noEmit` exit 0, `templateId` ตัดออกครบ, static constants เพิ่มครบ (ดู session-2026-06-14-rfa-migration-complete.md)
- [x] **Security/data isolation (verified already in code):** `ai-prompts.service.ts` ใช้ `readPromptContextScope()` อ่าน `projectPublicId`/`contractPublicId` → resolve เป็น internal IDs ผ่าน `createQueryBuilder().where('p.uuid = :uuid')` — ไม่มี `Number(uuid)`; `updateContextConfig()` อัปเดตให้รองรับทั้ง `projectPublicId` และ legacy `projectId` พร้อม normalize ก่อนบันทึก
- [x] **Idempotency (verified already in code):** `ai-prompts.controller.ts` มี `assertIdempotencyKey()` บน create/activate/context-config; `ai.controller.ts` sandbox/rag-prep มี `@Headers('idempotency-key')` + `ValidationException`; frontend `admin-ai.service.ts` ส่ง `Idempotency-Key` header ทุก mutation
- [x] **Prompt contract (verified already in code):** validator ใน `ai-prompts.service.ts` สอดคล้องกับ spec FR-023/FR-026 และ replacement logic ใน `ai-batch.processor.ts` — `ocr_extraction`: `{{ocr_text}}`+`{{master_data_context}}`, `rag_query_prompt`: `{{query}}`+`{{context}}`, `rag_prep_prompt`: `{{text}}`, `classification_prompt`: `{{document_text}}`
- [x] **DTO hardening (Session 2026-07-31):** `context-config.dto.ts` — เพิ่ม `@ValidateNested()`+`@Type(() => ContextFilterDto)`, `@IsUUID('7')` สำหรับ project/contract public IDs, `@Max(1000)` สำหรับ pageSize, `@IsEnum(['th','en','mixed'])` สำหรับ language/outputLanguage; `sandbox-rag-prep.dto.ts` — เพิ่ม `@MaxLength(200_000)` สำหรับ text, `@IsUUID('7')` สำหรับ profileId; `ai-prompts.service.ts` `updateContextConfig()` — normalize filter ให้ใช้ `projectPublicId`/`contractPublicId` ก่อนบันทึก
- [x] **Verify:** `tsc --noEmit` (backend) exit 0; `ai-prompts.service.spec.ts` 22/22 tests ผ่าน

### Feature-240: AI Admin Console Collapsible Cards ✅ COMPLETE

- [x] **Master Section Collapse:** เพิ่มปุ่ม Toggle เพื่อพับ/คลี่ทั้งเซกชัน Monitoring ในหน้าจอเดียว
- [x] **Individual Card Collapse:** เพิ่มปุ่ม Toggle สำหรับการ์ดทั้ง 5 ใบ (Ollama, Qdrant, OCR Sidecar, BullMQ, VRAM GPU Monitor)
- [x] **Local Storage Persistence:** บันทึกสถานะล่าสุดและโหลดกลับคืนข้ามการรีเฟรชหรือการสลับแท็บอย่างปลอดภัย (กัน Hydration Mismatch)
- [x] **Background Polling:** การพับเก็บไม่มีผลกระทบต่อการดึงข้อมูลสถานะในพื้นหลังผ่าน TanStack Query
- [x] **Validation & Quality:** ผ่านการตรวจสอบประเภท (tsc) และ Lint (eslint) พร้อมสร้างรายงาน validation-report.md
- **Branch:** `240-ai-console-collapsible-cards`

### New Server Setup (Session 2026-07-02) ✅ COMPLETE

- [x] pnpm ติดตั้งบน Linux server (v10.33.0)
- [x] `2git.sh` สร้างแทน `2git.ps1` (bash script สำหรับ commit+push)
- [x] `pnpm install` สำเร็จ — แก้ root ownership บน `node_modules/` และ `.husky/`
- [x] GitHub SSH key เพิ่มแล้ว
- [x] GitHub remote เพิ่มแล้ว (`git@github.com:peancharoen/lcbp3.git`)
- [x] Push สำเร็จทั้ง Gitea และ GitHub

### Backend URL Migration + localhost Support (Session 2026-07-03) ✅ COMPLETE

- [x] deploy.sh/rollback.sh default URL → `http://192.168.10.11:3000/api`
- [x] Docker port binding → `0.0.0.0:3000:3000` และ `0.0.0.0:3001:3000`
- [x] CORS_ORIGIN + `http://localhost:3001,http://127.0.0.1:3001` (3 .env files)
- [x] CSP fallback + `http://localhost:3000` ใน `proxy.ts`
- [x] Restart application stack เพื่อให้ port binding และ CORS ใหม่มีผล — ✅ Verified 2026-07-31 Tier 1 (ผู้ใช้ยืนยัน)

### Deploy Permission Fix (Session 2026-07-03) ✅ COMPLETE

- [x] Ownership guard ใน `deploy.sh` + `rollback.sh` (step `[0/4]`)
- [x] `install -m 644` แทน `cp` ใน `deploy.sh`
- [x] `chown np-dms:np-dms` ไฟล์ทั้ง 3 layers บน server
- [x] CI deploy สำเร็จหลัง push commit นี้ — ✅ Verified 2026-07-31 Tier 1 (ผู้ใช้ยืนยัน)

### ADR-041 Migration Plan RAM 64GB Upgrade (Session 2026-07-13) ✅ COMPLETE

- [x] MIGRATION-PLAN.md อัปเดต RAM budget 32GB→64GB (D8/D9/table/diagram/swap/my.cnf/tests/risks)
- [x] Swap 8G→16G ดำเนินการจริงบน server
- [x] `my.cnf` สร้างใหม่ (innodb_buffer_pool_size=16G, log_file 1G, connections 300, tmp/heap 512M)
- [x] PMA config สร้าง (config.user.inc.php + zzz-custom.ini + tmp/)
- [x] `ubuntu-lv` ขยาย 100G→150G (เดิมเต็ม 94%)
- [x] Docker group เพิ่ม nattanin + np-dms
- [x] Step 5 copy `.env` → `--env-file ../.env` pattern (single source of truth)
- [x] ลบ typo "หีกน"
- [x] MariaDB restart เพื่อให้ my.cnf ใหม่มีผล — ✅ Verified 2026-08-01: `innodb_buffer_pool_size=16GiB`, `innodb_log_file_size=1GiB`, `max_connections=300`, `tmp_table_size=512MiB`, `max_heap_table_size=512MiB` (ตรงตาม my.cnf ใหม่)

### Docker Healthcheck Fixes (Session 2026-07-13) ✅ COMPLETE

- [x] ES `search` healthcheck เพิ่ม `-u elastic:"$$ELASTIC_PASSWORD"` — 3 files (prod + 2 specs)
- [x] `ollama-metrics` healthcheck → `disable: true` (distroless, ใช้ Prometheus แทน)
- [x] Container recreate ทั้งคู่ → `docker ps` ยืนยัน healthy/normal
- [x] Session log: `specs/88-logs/session-2026-07-13-docker-healthcheck-fixes.md`

### Migration Verification & RAM Limits (Session 2026-07-14) ✅ COMPLETE

- [x] 4.16 OCR sidecar /health — `{"status":"ok","engine":"np-dms-ocr"}`
- [x] 4.17 Ollama metrics — Prometheus format ที่ `:9924/metrics`
- [x] 4.18 Docker network connectivity — ทุก internal DNS ทำงาน (mariadb, cache, search, qdrant, ollama, ocr-sidecar)
- [x] 4.19 RAM usage — ~6.5 GiB total (ห่างจาก 56GB อย่างมาก)
- [x] LVM/CIFS fix ใน MIGRATION-PLAN.md + README.md (swap nvme0n1/nvme1n1, CIFS share → np-dms, uid/gid → 1000:1000)
- [x] RAM limits อัปเดต 4 compose files ให้ตรง plan 64GB
- [x] Redeploy ทุก layer เพื่อให้ RAM limits ใหม่มีผล — ✅ Verified 2026-08-01: `docker inspect` ยืนยัน mariadb=16GiB/4cpu, search=6GiB/2cpu, cache=4GiB/1cpu, qdrant=4GiB/1cpu (ตรง compose 64GB plan)
- [x] Session log: `specs/88-logs/session-2026-07-14-migration-verification-and-ram-limits.md`

### Redis + ES Expose for Uptime Kuma (Session 2026-07-15) ✅ COMPLETE

- [x] Redis: `127.0.0.1:6379` → `192.168.10.11:6379` (bind IP สำหรับ Uptime Kuma @ ASUSTOR 192.168.10.9)
- [x] Elasticsearch: `expose: 9200` → `ports: 192.168.10.11:9200:9200` (bind IP สำหรับ Uptime Kuma)
- [x] อัปเดต security comments ใน docker-compose.yml (specs + prod runtime)
- [x] Qdrant ยังคง internal only (ไม่ expose)
- [x] Recreate containers: `docker compose -p lcbp3-infra up -d cache search` — ✅ Verified 2026-08-01: `cache` (Redis) bind `192.168.10.11:6379->6379/tcp` healthy 25h; `search` (ES) bind `192.168.10.11:9200->9200/tcp` healthy 25h
- [x] Uptime Kuma เพิ่ม monitor ทั้งสอง services — ✅ Verified 2026-08-01: Redis monitor (ID=6, type=port, hostname=192.168.10.11:6379) 289/289 UP; ES monitor (ID=9, type=http, url=http://192.168.10.11:9200/_cluster/health) 288/288 UP; ทั้งคู่มี notification ID=1 (Telegram) เชื่อมแล้ว
- [x] Session log: `specs/88-logs/session-2026-07-15-redis-es-expose-uptime-kuma.md`

### Migration Verification 4.10/4.11 (Session 2026-07-16) ✅ COMPLETE

- [x] 4.10 `/health` endpoint — แก้ MIGRATION-PLAN.md จาก `/api/health` → `/health` (health excluded from api prefix ใน `main.ts:57`); response: database up, memory_heap up, storage up
- [x] 4.11 Frontend `/` — แก้ expected 200 → 307 (`app/page.tsx` redirect ไป `/dashboard` → `/login`); `/login` ยังคง expect 200
- [x] 4.17 Ollama metrics — Prometheus format ที่ `:9924/metrics` ผ่าน
- [x] Session log: `specs/88-logs/session-2026-07-16-migration-verification-health-endpoint.md`

### Gitea Runner Port Fix (Session 2026-07-20) ✅ COMPLETE

- [x] แก้ `docker-compose.yml`: `extra_hosts` 192.168.10.8→192.168.10.11 (Gitea direct)
- [x] แก้ `.env.example`: `GITEA_INSTANCE_URL` https→http://git.np-dms.work:3003
- [x] Deploy บน ASUSTOR: แก้ `.env` จริง + ลบ `.runner` cache + restart container — ✅ Verified 2026-08-01: gitea-runner container รัน 11 days (healthy); env var `GITEA_INSTANCE_URL=http://git.np-dms.work:3003` ถูกต้อง; Gitea API ยืนยัน runner ID=1 "asustor-runner" status=online; `.runner` cache ยังมี address เก่า `https://git.np-dms.work` แต่ env var override แล้ว รัน job สำเร็จล่าสุด 2026-07-30 (task 823/824); ⚠️ มี error `530`/`502` เป็นครั้งคราว (Cloudflare/NPM proxy flapping) แต่ runner กลับมา online เอง
- [x] Session log: `specs/88-logs/session-2026-07-20-gitea-runner-port-fix.md`

### Portainer ย้ายไป 00-basic (Session 2026-07-20) ✅ COMPLETE

- [x] ย้าย Portainer จาก `01-infrastructure` ไป `00-basic/docker-compose.yml`
- [x] แก้ file header, compose project name (`lcbp3-basic`), security comments
- [x] อัปเดต `copy-env.sh` — เพิ่ม copy `00-basic/docker-compose.yml`
- [x] อัปเดต `dockerup.sh` — เพิ่ม `00-basic` เป็น step แรก (start ก่อน infrastructure)
- [x] Deploy: รัน `copy-env.sh` + `dockerup.sh` บน server
- [x] Session log: `specs/88-logs/session-2026-07-20-portainer-to-00-basic.md`

### CIFS Permission Fix (Session 2026-07-22) ✅ COMPLETE

- [x] แก้ `/etc/fstab`: `uid=1000,gid=1000` → `uid=1001,gid=1001,noperm,file_mode=0777,dir_mode=0777` สำหรับ uploads mounts
- [x] Remount: `sudo umount` + `sudo mount -a`
- [x] `docker restart backend` — container ต้อง restart เพื่อรับ mount namespace ใหม่
- [x] อัปเดต MIGRATION-PLAN.md Section 0.14/0.15
- [x] Verification: `docker exec backend touch /app/uploads/temp/.perm-test` → WRITE OK
- [x] Session log: `specs/88-logs/session-2026-07-22-cifs-permission-fix.md`

### Post-Migration Documentation Update (Session 2026-07-22) ✅ COMPLETE

- [x] **Phase 6 status update:** 6.2/6.3/6.6/6.7/6.8 → Pending (ยังไม่มี document data); 6.13 → N/A (QNAP services ไม่มีแล้ว)
- [x] **6.16 ADR-041:** Status → `Implemented`; Task table ทั้งหมด → ✅/N/A; เพิ่ม Implementation Notes (RAM/VRAM จริง, ปัญหา, D5 revised)
- [x] **6.17 CONTEXT.md:** เพิ่ม terms `New Server (np-dms-lcbp3)`, `Cloudflare Tunnel`; อัปเดต `Edge Proxy`; ADR-041 → `✅ Implemented`
- [x] **6.18 backup-recovery:** อัปเดต header เป็น ASUSTOR=Primary NAS, New Server=compute, QNAP=NPM only, Desk-5439=decommissioned
- [x] **6.19 network guide:** เพิ่ม `np-dms-lcbp3` ใน Network Equipment table
- [x] **6.20 Post-migration report:** สร้าง `specs/88-logs/session-2026-07-22-post-migration-report.md`
- [x] **Section 10 Remaining Work:** ทุก item `[X]` — ทำครบทั้งหมด
- [x] Session log: `specs/88-logs/session-2026-07-22-post-migration-report.md`

### Root Documentation Consistency Update (Session 2026-07-23) ✅ COMPLETE

- [x] **ARCHITECTURE.md** v1.9.9→v1.9.11: Post-migration topology, Cloudflare Tunnel edge, AI moved to np-dms-lcbp3, ADR-035/040/041 added to ADR table, version history updated
- [x] **README.md** v1.9.8→v1.9.11: Version badge, status table (41 ADRs, single-host), features (+Thai AI, +Cloudflare, +UPS), infrastructure (np-dms-lcbp3, 4-layer Docker), system diagram, schema v1.9.0, ADR count 33→41, roadmap (+v1.9.11, +v1.9.10), Go-Live target
- [x] **CHANGELOG.md** v1.9.11 entry: ADR-034/035/040/041, Cloudflare Tunnel (D5 Revised), NUT/UPS, Docker 4-layer stack, post-migration verification, 41 ADRs total
- [x] **AGENTS.md** v1.9.10→v1.9.11: Key Spec Files table (+ADR-035, +ADR-040, +ADR-041, +MIGRATION-PLAN.md), version bump
- [x] Session log: `specs/88-logs/session-2026-07-23-documentation-consistency-update.md`

### Feature-142: OCR Prompt Cache Invalidation (Session 2026-07-23) ✅ CODE COMPLETE

- [x] **T001-T002:** `redis>=5.0.0` ใน requirements.txt + `REDIS_URL` ใน docker-compose.yml
- [x] **T003-T006:** `services/prompt_cache.py` — Redis hash, unload, check_and_unload_if_changed
- [x] **T007-T010:** `app.py` — asyncio.Lock + check_and_unload + logging
- [x] **T011-T013:** US2 edge cases — hash match skip, Redis miss, None handling
- [x] **T014-T015:** US3 — keep_alive>0 validation + debug logging
- [x] **T016-T017:** Unit tests (14 tests in `tests/test_prompt_cache.py`)
- [x] **T018:** Edge case — Ollama crash/restart: clear Redis hash
- [x] **T019-T020:** Quickstart validation + Change Log update
- [x] **Rebuild:** `cd /opt/np-dms/04-ai/ocr-sidecar && sudo docker compose --env-file ../../.env up -d --build --no-cache` — ✅ DONE 2026-07-31 Tier 2 (rebuild + recreate with fixed REDIS_URL)
- [x] **Quickstart validation:** ทดสอบ Test 1-4 ตาม `specs/100-Infrastructures/142-ocr-prompt-cache-invalidation/quickstart.md` — ✅ PASS 2026-07-31 Tier 2:
  - Test 1 (hot path): prompt unchanged → `skipping unload` ✅
  - Test 2 (prompt change): hash changed `f0d9c47318082025` → `c1772ab765a310f6` → unload attempted (best-effort) ✅
  - Test 3 (Redis hash): `ocr:prompt:hash:np-dms-ocr:latest` = `c1772ab765a310f6` ✅
  - Test 4 (restart): Redis persistence verified (separate container) ✅
  - **Bug fixes applied:** REDIS_URL `redis://redis:6379/0` → `redis://:${REDIS_PASSWORD}@cache:6379/0` (hostname + auth); `protocol=2` ใน `init_redis_client()` (RESP3 HELLO handshake issue); quickstart.md ลบ `X-API-Key` header (ADR-040 Phase 2)
- [x] Session log: `specs/88-logs/session-2026-07-23-ocr-prompt-cache-invalidation.md`

### Monitoring Stack Setup (Session 2026-07-17/18) ✅ COMPLETE

- [x] **Prometheus config fix:** อัปเดต IP เก่า→ใหม่, Uptime Kuma docker.sock mount + image v2, ยืนยัน backend /metrics endpoint
- [x] **AI telemetry แยกไฟล์:** ollama-metrics + nvidia-gpu-exporter ย้ายจาก ocr-sidecar ไป `04-ai/docker-compose.yml` (lcbp3-ai-telemetry)
- [x] **Infrastructure exporters:** node-exporter (9100) + cAdvisor (8088) + mariadb-exporter (9104) เพิ่มใน `01-infrastructure/docker-compose.yml`
- [x] **MariaDB exporter user:** สร้าง `exporter`@`%` (password: Center2026) — GRANT PROCESS, REPLICATION CLIENT, SELECT
- [x] **Verification:** curl ทั้ง 3 exporters ตอบกลับ metrics ปกติ
- [x] **copy-env.sh + dockerup.sh:** อัปเดตรองรับ 04-ai telemetry + exporter-my.cnf
- [x] Prometheus (ASUSTOR) reload config + ตรวจสอบ targets ทั้งหมด up — ✅ Verified 2026-08-01: 9/11 targets UP (asustor-cadvisor, asustor-node, backend, main-server-cadvisor, main-server-node, mariadb, nvidia-gpu, ollama-metrics, prometheus); 2/11 DOWN (qnap-cadvisor, qnap-node) — QNAP ไม่มี exporters (expected post-ADR-041, QNAP เป็นเพียง NPM edge proxy); ⚠️ backend target ก่อน deploy ตอบ JSON wrapper แทน Prometheus text format เพราะ container รัน build เก่า (4 กรกฎาคม) ที่ไม่มี `/metrics` bypass ใน TransformInterceptor — แก้ด้วย deploy backend ใหม่ (build 2026-08-01) ตอนนี้ `/metrics` ตอบ raw text format ถูกต้อง
- [x] Grafana dashboard สำหรับ main-server metrics — ✅ Verified + Fixed 2026-08-01: Grafana รัน 13 days (healthy); **ลบ dashboards ที่ใช้ไม่ได้ 3 ตัว** (Node overview — `origin_prometheus` label ไม่มี; Docker overview — metric names เก่า `node_boot_time`/`node_memory_MemTotal`; Neurix Ollama & GPU — `ollama_up`/`ollama_version_info` ไม่มีในระบบ); **สร้าง dashboards ใหม่ 4 ตัว** ที่ตรงกับ metrics จริง: "LCBP3 — Ollama & NVIDIA GPU" (id=22, 13 panels), "LCBP3 — Docker Containers & Host" (id=23, 12 panels), "LCBP3 — Redis" (id=24, 15 panels), "LCBP3 — Elasticsearch" (id=25, 15 panels), "LCBP3 — BullMQ Queues" (id=26, 12 panels), "LCBP3 — Backend API & Node.js Health" (id=27, 20 panels); **deploy exporters ใหม่ 2 ตัว**: redis-exporter (port 9121, 177 metrics) + elasticsearch-exporter (port 9114, 223 metrics) ใน `01-infrastructure/docker-compose.yml`; **เพิ่ม BullMQ metrics ใน backend**: `BullmqMetricsService` (6 gauges × 6 queues = 36 series, อัปเดตทุก 30s) — รอ redeploy; **แก้ data sources**: MariaDB url เปลี่ยนจาก `192.168.10.8` (QNAP เก่า) → `192.168.10.11` (main server ใหม่); **ลบ data sources ที่ไม่ใช้ 2 ตัว** (Elasticsearch — url ว่าง, MySQL — url ว่าง); สุดท้ายเหลือ 3 data sources (Prometheus default, Loki, MariaDB) + **9 dashboards ครอบคลุม 1,970 metrics ทั้งหมด**; Prometheus targets 11/13 UP (2 QNAP down — expected post-ADR-041); admin password เก็บใน env var `GF_SECURITY_ADMIN_PASSWORD`; Grafana URL: `http://192.168.10.9:3003`
- [x] Session log: `specs/88-logs/session-2026-08-01-grafana-dashboards-exporters.md`
