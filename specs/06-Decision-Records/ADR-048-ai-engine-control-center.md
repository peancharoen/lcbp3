# ADR-048: AI Engine Control Center (from Read-Only Monitoring to Active Control)

**Status:** Proposed
**Date:** 2026-08-24
**Decision Makers:** Senior Full Stack Developer, System Architect
**Amends:** none (additive — extends `/admin/ai/system` UI and `AiController` endpoints)
**Related Documents:**

- [ADR-033: Active Model & OCR Runner Management](./ADR-033-active-model-and-ocr-management.md)
- [ADR-041: Single-Host Server Consolidation](./ADR-041-server-consolidation.md)
- [ADR-043: AI Architecture — Current State](./ADR-043-ai-architecture-current-state.md) (§13 Server Topology, §10 AI Admin Console)
- [ADR-007: Error Handling Strategy](./ADR-007-error-handling-strategy.md)
- [ADR-016: Security & Authentication](./ADR-016-security-authentication.md)

---

## 🎯 Gap Analysis & Purpose

### ปิด Gap จากเอกสาร/โค้ดปัจจุบัน

- **`AiInfrastructureMonitoring.tsx` (หน้า `/admin/ai/system`):** ปัจจุบันเป็น **read-only dashboard** เท่านั้น (Ollama/Qdrant/OCR Sidecar/BullMQ status cards + VRAM card แยกต่างหาก) — ไม่มีช่องทางให้ admin ควบคุมอะไรได้เลยจากหน้านี้
  - **การแก้ไข:** เพิ่ม active control actions (load/unload model, clear failed jobs) โดยไม่ทิ้ง read-only value เดิม
- **ADR-041 §D1 (Layer 4 — AI Telemetry):** มี `nvidia-gpu-exporter` (GPU temp/util/power) และ `ollama-metrics` (per-model VRAM/tokens) แล้ว แต่ **ไม่มี host-level exporter** (CPU core count, %load, temp ของตัวเครื่อง `np-dms-lcbp3`) — ข้อ 1.1 ของ request นี้จึงไม่มีแหล่งข้อมูลรองรับ
  - **การแก้ไข:** เพิ่ม `node-exporter` เข้า Layer 4 telemetry ตามแบบเดียวกับ 2 exporter ที่มีอยู่
- **`ai.controller.ts` (AI Model Management, ADR-027):** มีเฉพาะ DB catalog operations (`admin/models` add/remove/toggle-active) ซึ่งเป็นการเปิด/ปิดสิทธิ์ใช้งานโมเดลใน catalog เท่านั้น **ไม่มี endpoint สั่ง Ollama โหลด/เอาโมเดลออกจาก VRAM จริง** — ข้อ 1.2/1.3 ของ request ต้องการ action ระดับ runtime ที่ยังไม่มี
  - **การแก้ไข:** เพิ่ม endpoint ที่เรียก Ollama `/api/generate` ด้วย `keep_alive` เพื่อ load/unload จริง
- **BullMQ Queue Health card:** แสดงเฉพาะ aggregate count (active/waiting/completed/failed ต่อ queue) ไม่มี per-job detail และไม่มีการล้าง failed jobs
  - **การแก้ไข:** เพิ่ม job list endpoint (5 queues: `ai-realtime`, `ai-batch`, `ai-ingest`, `ai-rag`, `ai-vector-deletion`) และ per-queue "Clear Failed" action

---

## 🏛️ Context and Problem Statement

หน้า `/admin/ai/system` ถูกออกแบบไว้ตั้งแต่ ADR-027 (AI Admin Console) เป็น monitoring dashboard ล้วน ๆ เพื่อให้ Superadmin เห็นสุขภาพของ Ollama/Qdrant/OCR Sidecar/BullMQ ได้แบบ real-time (poll ทุก 30 วินาที) แต่เมื่อระบบใช้งานจริงพบว่า admin ยังต้อง:

1. ตรวจสอบภาระของ **เครื่อง server เอง** (`np-dms-lcbp3`, 192.168.10.11) ไม่ใช่แค่ GPU/Ollama — เช่น เมื่อ CPU สูงผิดปกติจาก process อื่น (Elasticsearch, MariaDB) ที่ไม่เกี่ยวกับ AI แต่แชร์ host เดียวกันตาม ADR-041
2. ตัดสินใจโหลด/เอาโมเดลออกจาก VRAM เอง (เช่น ก่อนรัน Migration batch ขนาดใหญ่ ต้องการ unload `np-dms-ocr` ล่วงหน้าเพื่อกัน VRAM ให้ `np-dms-ai`) แทนที่จะรอ automatic switching ใน `ai-batch.processor.ts`
3. เห็นว่า BullMQ batch queue มี job อะไรค้างอยู่บ้าง (ไม่ใช่แค่ตัวเลขรวม) และล้าง failed jobs เก่าที่ debug เสร็จแล้วโดยไม่ต้องเข้า Redis CLI

การเพิ่ม active control เข้าไปในหน้าที่เดิมเป็น read-only ต้องระวัง 2 เรื่องหลัก: (ก) **Race condition** กับ automatic model switching ที่มีอยู่แล้วใน `ai-batch.processor.ts` (unload main → load OCR → generate → reload main ระหว่าง `ocr-extract` job) และ (ข) **Destructive action safety** ตาม ADR-007 (ต้องมี layered error handling, ไม่ทำลายข้อมูลเกินขอบเขตที่ประกาศ)

---

## ⚖️ Decision Drivers

- **Operational Visibility:** Admin ต้องเห็นภาระของ host จริง ไม่ใช่แค่ GPU/Ollama
- **Minimal Infrastructure Overhead:** ไม่เพิ่มภาระให้ server หรือเพิ่ม dependency ใหม่ที่ไม่จำเป็น (เช่น ไม่บังคับพึ่ง Prometheus บน ASUSTOR ซึ่งเป็นเครื่องคนละเครื่อง)
- **Safety over Convenience:** Action ที่ทำลายข้อมูลหรือกระทบ job ที่กำลังรันต้องถูก guard ก่อนเสมอ (ADR-007)
- **Consistency:** ใช้ pattern RBAC/Audit เดียวกับ endpoint อื่นใน `ai.controller.ts` แทนการสร้างมาตรฐานใหม่
- **No Duplicate Telemetry Stack:** ใช้ pattern exporter เดียวกับที่ ADR-041 วางไว้แล้ว (`nvidia-gpu-exporter`, `ollama-metrics`) แทนการคิดสถาปัตยกรรมใหม่

---

## 🔬 Considered Options

### CPU/Host Metrics Source

**Option A — Backend อ่าน `/proc` ตรง (Node.js `os` module / `systeminformation`)**

- ❌ ต้องแก้ container ให้ mount `/proc` ของ host หรือรันแบบ host network — กระทบ Docker isolation ที่ ADR-041 วางไว้
- ❌ Parsing เกิดขึ้นซ้ำในทุก request ภายใน process หลักของ backend แทนที่จะเป็น purpose-built binary

**Option B — เพิ่ม `node-exporter` + backend query ตรง (เลือกแนวทางนี้)**

- ✅ Pattern เดียวกับ `nvidia-gpu-exporter`/`ollama-metrics` ที่มีอยู่แล้ว — footprint เล็ก (~20MB RAM, <0.1 CPU)
- ✅ Backend query `/metrics` ตรง ไม่ต้องพึ่ง Prometheus บน ASUSTOR (ลด external dependency สำหรับหน้านี้)
- ✅ ไม่กระทบ Docker network isolation — เป็น container เพิ่มเข้า Layer 4 ตามโครงสร้างเดิม

**Option C — Query ผ่าน Prometheus HTTP API (ASUSTOR)**

- ✅ สอดคล้องกับ dashboard ระยะยาว (Grafana) ที่มีแผนอยู่แล้ว
- ❌ หน้า `/admin/ai/system` จะพังถ้า ASUSTOR/Prometheus ไม่ทำงาน แม้ np-dms-lcbp3 เองปกติดี — ผิดหลัก fail-independent ของ core admin page

### Model VRAM Load/Unload Control

**Option A — Manual load/unload ไม่มี guard**

- ❌ เสี่ยง race กับ automatic switching ใน `ai-batch.processor.ts` — อาจทำให้ job ที่กำลังรัน generate ล้มเหลวกลางคัน

**Option B — Block เมื่อมี active job (เลือกแนวทางนี้)**

- ✅ ปลอดภัยที่สุด สอดคล้อง ADR-007 (แจ้งเหตุผลชัดเจนแทนที่จะปล่อยให้ fail แบบ silent)
- ⚠️ Admin ต้องรอ queue ว่างก่อนควบคุมโมเดลเอง — ยอมรับได้เพราะเป็น manual action ไม่ใช่ user-facing flow

### Clear Failed Jobs Scope

**Option A — ล้างทุก queue พร้อมกัน**

- ❌ เสี่ยง clear คิวที่ไม่ตั้งใจ (5 queues ใช้ pattern ชื่อคล้ายกัน)

**Option B — เลือก queue ก่อน clear (per-queue action, เลือกแนวทางนี้)**

- ✅ ชัดเจนว่า clear คิวไหน ปลอดภัยกว่า
- ✅ Scope เฉพาะ `failed` state เท่านั้น (ไม่แตะ `active`/`waiting`) — ป้องกัน backlog หาย

---

## 📌 Decision Outcome

**Chosen Option:** ขยาย `/admin/ai/system` จาก Read-Only Monitoring → **AI Engine Control Center** ผ่านการเพิ่ม telemetry source ใหม่ (node-exporter) และ control endpoints ใหม่ใน `AiController` โดยยึด RBAC/Audit pattern เดิมทั้งหมด

### D1: Host-Level Metrics ผ่าน `node-exporter`

- เพิ่ม container `node-exporter` (official Prometheus exporter) เข้า `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/docker-compose.yml` (Layer 4 — AI Telemetry) ตาม pattern เดียวกับ `nvidia-gpu-exporter`/`ollama-metrics`:
  - Bind `192.168.10.11:9100` (publish ออก LAN เหมือน `nvidia-gpu-exporter` ที่ `:9835`) เพื่อให้ Prometheus (ASUSTOR) scrape ไปทำ Grafana dashboard ระยะยาวได้ด้วย โดยไม่ผูก backend ให้พึ่งพา Prometheus
  - Resource limit เบา (`cpus: 0.1-0.25`, `memory: 128-256M`) ตาม pattern เดิม
  - Mount `/proc`, `/sys` เป็น read-only ใน container ของ `node-exporter` เอง (มาตรฐาน official image) — **ไม่แตะ backend/frontend container**
- Backend เพิ่ม `NodeMetricsService` (ใหม่ ภายใต้ `backend/src/modules/ai/services/`) query `http://192.168.10.11:9100/metrics` โดยตรง (ไม่ผ่าน Prometheus บน ASUSTOR):
  - **สถาปัตยกรรม Background Poller & Redis Cache:** มี Background Poller (`@Interval(10_000)` ทุก 10 วินาที) ทำหน้าที่ scrape `node-exporter` แล้วคำนวณ Delta เก็บลง Redis (`ai:metrics:host_summary`, TTL 30s) เพื่อให้ Endpoint `GET /ai/admin/host/metrics` ตอบกลับได้ทันทีภายใน **< 5ms** โดยไม่มีการ blocking/sleeping ใน HTTP request
  - **CPU Load Calculation & Cold Start Fallback:**
    - ปกติ: คำนวณ % CPU Load รวมและราย Core จาก Delta 2 ตัวอย่างของ `node_cpu_seconds_total`:
      $$\text{CPU Usage \%} = 100 \times \left(1 - \frac{\Delta \text{idle}}{\Delta \text{total}}\right)$$
    - ช่วง Cold Start หมายถึง **10 วินาทีแรกหลัง `NodeMetricsService` เริ่ม poll ครั้งแรก** (เช่น ตอน backend restart/deploy) — ไม่ใช่ host boot จริง เพราะยังไม่มี sample คู่ก่อนหน้าให้คำนวณ delta ได้ ช่วงนี้จะคำนวณค่าประมาณการชั่วคราวผ่าน Single-scrape Gauge Metric `node_load1` (System Load Average): $\min(100, (\text{node\_load1} / \text{Core Count}) \times 100)$ พร้อม flag `isEstimated: true` — **หมายเหตุ:** เนื่องจาก backend อาจ restart บ่อยช่วง deploy ทำให้ค่านี้ขึ้นชั่วคราวได้บ่อยกว่าที่คิด แต่เป็นเพียง 10 วินาทีต่อครั้งและ frontend แสดง label "ประมาณการ" กำกับไว้ ไม่ใช่ปัญหาความถูกต้องระยะยาว
  - **Memory:** `node_memory_MemTotal_bytes` / `node_memory_MemAvailable_bytes`
  - **Hardware Temperature Resolution (Heuristic Priority):**
    - Priority 1: `node_hwmon_temp_celsius` โดย Match `chip` (`coretemp`, `k10temp`, `zenpower`, `cpu_thermal`, `soc_thermal`) และเลือก Sensor ตัวแทนรวม (`Package id 0`, `Tctl`, `Tdie`, `temp1`)
    - Priority 2: หากไม่มี Package Sensor ให้ดึงค่าจาก Core ทั้งหมด แล้วหา **Max Temperature** ป้องกันจุดวิกฤต Thermal Throttling
    - Priority 3: ACPI Fallback ไปยัง `node_thermal_zone_temp{type=~"cpu-thermal|acpitz|x86_pkg_temp"}`
    - Priority 4: หากไม่มี Sensor เลย ให้คืนค่า `null` และ Frontend แสดงเป็น `N/A` อย่างสง่างาม (Graceful Degradation ตาม ADR-007)
  - Timeout สั้น (3s) พร้อม graceful degradation (แสดง `N/A` ถ้า query ล้มเหลว) ตาม ADR-007 System Error pattern — ห้ามทำให้ทั้งหน้าพังถ้า exporter ตาย
  - **Sparkline History (Redis List):** ทุกครั้งที่ Background Poller ทำงาน (ทุก 10s) ให้ `LPUSH` ค่า snapshot ปัจจุบัน (CPU%, RAM%, Temp) เข้า Redis list `ai:metrics:host_history` แล้ว `LTRIM` ให้เหลือ 15 รายการล่าสุดเสมอ (ไม่มี TTL แยก — ต่ออายุทุกครั้งที่ poll) เพื่อให้กราฟ trend คงอยู่แม้ผู้ใช้ reload หน้าหรือเปิดแท็บใหม่
- Endpoint ใหม่: `GET /ai/admin/host/metrics` (permission `system.manage_all` เหมือน endpoint อื่น, cache อ่านจาก Redis — ทั้ง current summary และ history array สำหรับ sparkline ส่งกลับใน response เดียวกัน)
- **Frontend UI Presentation & Refresh Strategy:**
  - Auto-refresh ทุก 10 วินาที (Sync กับ Background Poller ของ Backend) พร้อมปุ่ม Toggle Pause/Play และปุ่ม Manual Refresh บน Header
  - **Sparkline Mini-Charts:** แสดงการ์ดตัวชี้วัด (CPU %, RAM %, Temp °C) พร้อมเส้นกราฟ Sparkline แนวโน้มย้อนหลัง 2–3 นาที (15 data points ล่าสุด) ให้เห็นพฤติกรรมโหลดของเครื่องได้อย่างชัดเจน

### D2: รวม VRAM Card เข้ากับ Ollama Engine Card

- ยุบ VRAM card (query แยกจาก `adminAiService.getVramStatus()`) เข้าไปเป็นส่วนหนึ่งของ Ollama Engine card เดิมใน `AiInfrastructureMonitoring.tsx`
- แสดงเป็น **ตารางโมเดลเดียว** ครอบคลุมทั้งโมเดลที่ active ใน catalog (`ai_settings`) และโมเดลที่กำลังโหลดอยู่จริงใน VRAM (`VramMonitorService.getVramStatus()`): คอลัมน์ `ชื่อโมเดล (canonical) | VRAM usage (MB) | สถานะ (Loaded/Not Loaded) | ปุ่ม Load/Unload`
- ไม่เปลี่ยน backend endpoint เดิมของ VRAM (`GET /ai/admin/vram/status` ยังใช้ต่อ) — เปลี่ยนเฉพาะ frontend composition

### D3: Real VRAM Load/Unload Endpoint พร้อม Concurrency, Mutex Guard & Auto-Eviction

- เพิ่ม endpoint ใหม่:
  - `POST /ai/admin/models/:modelName/vram/load` — เรียก Ollama `/api/generate` ด้วย prompt ว่างและ `keep_alive` ตาม policy ปัจจุบันของโมเดลนั้น (จาก `AiPolicyService.getModelDefaults()` / execution profile) เพื่อบังคับโหลดเข้า VRAM
  - `POST /ai/admin/models/:modelName/vram/unload` — เรียก Ollama `/api/generate` ด้วย `keep_alive: 0` เพื่อบังคับ unload ทันที
- **Concurrency Guard & Backlog Check (บังคับ):**
  - ก่อนอนุญาต load/unload (รวมถึง Auto-Eviction ด้านล่าง) ต้องเช็คผ่าน `AiQueueService` ว่า **ทั้ง `ai-realtime` และ `ai-batch` ไม่มี job สถานะ `active` หรือ `waiting` เลยแม้แต่รายการเดียว** (global empty-queue check — ไม่ filter เฉพาะ job ที่เกี่ยวกับโมเดลนั้น เพราะ BullMQ job payload ไม่ได้ผูก field "model" ไว้สม่ำเสมอทุก jobType จึง filter แบบ per-model ไม่น่าเชื่อถือพอ)
  - ถ้ามี job ค้างอยู่ ให้ตอบ `409 Conflict` พร้อม `userMessage` ตาม ADR-007 (เช่น _"ไม่สามารถโหลด/เอาโมเดลออกได้เนื่องจากมีงานกำลังประมวลผลหรือรอคิวอยู่ {count} รายการ กรุณารอให้งานเสร็จสิ้นก่อน"_) — Frontend disable ปุ่มพร้อม tooltip อธิบายเหตุผลเดียวกัน
  - Guard นี้เป็นข้อกำหนดเดียวที่ป้องกัน race กับ automatic model switching ใน `ai-batch.processor.ts` (unload main → load OCR → generate → reload main) — เพราะ switching จะเกิดขึ้นเฉพาะตอนมี job `active` เท่านั้น ซึ่งถูก guard block ไว้แล้ว
- **Auto-Eviction / Exclusive Residency Policy (ป้องกัน VRAM OOM):**
  - เมื่อ Guard ด้านบนผ่านแล้ว (queue ว่างจริง) และการโหลดโมเดลเป้าหมายเข้า VRAM อาจทำให้ VRAM ล้น (Single GPU 12-16GB ไม่พอรับ 2 โมเดลพร้อมกัน) ระบบจะทำ **Auto-Eviction** สั่ง Unload โมเดลอื่นที่โหลดค้างอยู่ก่อนโดยอัตโนมัติ เพื่อป้องกัน GPU Memory Spilling ไปยัง CPU
  - Auto-Eviction **ไม่มี guard เพิ่มเติมของตัวเอง** — อาศัย global empty-queue check เดียวกับ Load/Unload ด้านบน (เกิดเป็นส่วนหนึ่งของ transaction เดียวกัน ไม่ใช่ background job แยก)
- **Sidecar GPU Coordination (BGE lazy-load):**
  - BGE-M3 และ BGE-Reranker อยู่นอก Ollama `/api/ps` จึงถูกจัดการโหลด/ยกเลิกโหลดโดย OCR sidecar (lazy-load ตาม demand + auto-unload หลัง idle 300s) ตาม ADR-040
  - ก่อนโหลด Ollama model สำหรับ OCR หรือ LLM generation ระบบจะสั่ง `OcrService.unloadBgeModels()` ผ่าน `ai-batch.processor.ts` (ก่อน OCR job) และ `AiRagService` (หลัง rerank ก่อน generate) ตามลำดับ
  - `VramMonitorService` ไม่บังคับ BGE โดยตรง แต่ admin UI แสดงสถานะ BGE ควบคู่ Ollama model ผ่าน `GET /ai/admin/bge/status`
  - บังคับใช้นโยบาย **GPU Coordination** ใน `CONTEXT.md` — Ollama model กับ BGE ไม่ถือ VRAM ซ้อนกันในช่วง OCR/LLM
- **ปิดช่องโหว่ TOCTOU ด้วย Single-Point Redis Lock ใน `AiQueueService` (ไม่แก้ Worker/Processor เดิม):**
  - ปัญหา: Guard เช็ค "queue ว่าง" ณ เวลา request แต่ Ollama ใช้เวลา 1-3 วินาทีจึง load/unload เสร็จจริง — ช่วงนี้อาจมี job ใหม่ enqueue เข้ามาและถูก worker หยิบไปประมวลผลชน model ที่กำลัง transition
  - แก้แบบ minimal-touch: เพิ่ม Redis lock `ai:model:transitioning` (TTL 15s) ที่ตั้งก่อนเรียก Ollama และลบทันทีที่เสร็จ — จุดเดียวที่ต้องเช็ค lock คือ **`AiQueueService.enqueue*()` methods** (จุด choke point เดียวที่ทุก endpoint enqueue เข้า `ai-realtime`/`ai-batch` เรียกผ่านอยู่แล้ว) โดยถ้า lock ติดอยู่ ให้ `enqueue*()` throw `SystemException` (503, ตาม ADR-007) ก่อน `queue.add()` จะถูกเรียก
  - **ไม่แตะ BullMQ Worker/Processor (`ai-batch.processor.ts`) เลย** — เพราะจุดป้องกันอยู่ที่ "ทางเข้า" (enqueue) ไม่ใช่ "ทางออก" (process) จึงเป็นการเปลี่ยนแปลง 1 จุดใน service layer เดียว ไม่ใช่การแก้ทุก endpoint หรือทุก processor
- **Unload Confirmation UX:** การกด Unload ทุกครั้งต้องแสดง Confirmation Dialog เสมอ พร้อมแจ้งเตือนเรื่อง Cold-Start Latency (_"การเอาโมเดลออกจากหน่วยความจำจะทำให้คำขอถัดไปของผู้ใช้ต้องใช้เวลาโหลดโมเดลใหม่ 5-10 วินาที ยืนยันการดำเนินการหรือไม่?"_)
- Permission: `system.manage_all` (เฉพาะ Superadmin)
- Audit: `@Audit('LOAD_MODEL_VRAM' | 'UNLOAD_MODEL_VRAM', 'ollama')` ตาม pattern ของ `applyProfile`

### D4: Batch/Queue Job Detail Viewer & Individual Job Actions (5 Queues)

- เพิ่ม endpoints:
  - `GET /ai/admin/queues/:queueName/jobs?status=&page=&limit=` — คืนรายการ job (`jobId`, `jobType`, `status`, `createdAt`/`processedAt`/`finishedAt`, `failedReason` ถ้ามี) จาก BullMQ `Queue.getJobs()`
  - `POST /ai/admin/queues/:queueName/jobs/:jobId/retry` — สั่งให้ BullMQ ลองประมวลผล Failed Job นั้นใหม่อีกครั้ง (`Job.retry()`)
  - `DELETE /ai/admin/queues/:queueName/jobs/:jobId` — ลบ Job เฉพาะตัวนั้นออกจากคิว (`Job.remove()`) **อนุญาตทุกสถานะ รวม `active`** — ⚠️ **คำเตือนสถาปัตยกรรม:** `Job.remove()` บน job ที่ `active` อยู่ลบเฉพาะ BullMQ record ใน Redis เท่านั้น **ไม่ได้หยุด worker process/Ollama call ที่กำลังรันจริง** — worker จะรันต่อจนจบแล้วพยายาม update job ที่ถูกลบไปแล้ว (จะ error แบบ silent ใน log แต่ไม่กระทบ job อื่น) Frontend **ต้องแสดง Confirmation Dialog เตือนเรื่องนี้ชัดเจน** ก่อน delete job ที่สถานะ `active` เสมอ (ข้อความเช่น _"งานนี้กำลังประมวลผลอยู่ การลบจะเอาออกจากรายการเท่านั้น กระบวนการเบื้องหลังจะยังทำงานต่อจนเสร็จ ยืนยันหรือไม่?"_)
- ครอบคลุมทั้ง 5 queues: `ai-realtime`, `ai-batch`, `ai-ingest`, `ai-rag`, `ai-vector-deletion` — `queueName` เป็น path param ที่ validate กับ allowlist ของ queue constants ที่มีอยู่แล้ว (`queue.constants.ts`)
- **Frontend UX (Slide-over Sheet / Drawer):**
  - เมื่อ Admin คลิกที่การ์ด Queue ใด ๆ จะเปิด Drawer เลื่อนจากขอบขวาของจอ (Slide-over Sheet) แสดงรายการ Jobs รายตัว พร้อมแท็บกรองสถานะ (`All`, `Failed`, `Active`, `Waiting`), Pagination และปุ่ม "Clear Failed" ที่หัว Header ของ Drawer
  - **Individual Row Actions:** ในแต่ละแถวของตาราง Job จะมีปุ่ม **"Retry"** (สำหรับงานที่ล้มเหลว) และปุ่ม **"Delete"** (สำหรับงานที่ต้องการลบเฉพาะตัว)

### D5: Clear Failed Jobs (Per-Queue, Scoped to `failed` เท่านั้น, รันแบบ Async Job)

- **Async Job Pattern (ไม่รัน Synchronous ใน HTTP request):** เนื่องจากอาจมี Failed Jobs สูงสุดถึง 10,000 รายการ (chunk ทีละ 1,000) การรันตรงใน HTTP handler เสี่ยง timeout/blocking event loop จึงใช้ pattern เดียวกับ sandbox job ที่มีอยู่แล้วในระบบ (enqueue → poll status):
  - `POST /ai/admin/queues/:queueName/clear-failed` — enqueue internal job type `clear-failed-jobs` เข้า `ai-batch` queue พร้อม payload `{ targetQueueName }` แล้วตอบกลับทันที `{ jobId, status: 'queued' }` (ไม่รอผลลัพธ์)
  - `GET /ai/admin/queues/:queueName/clear-failed/:jobId` — endpoint สำหรับ frontend polling สถานะ (เหมือน pattern `GET /ai/admin/sandbox/job/:id` ที่มีอยู่แล้ว)
  - Processor (`ai-batch.processor.ts` เพิ่ม case ใหม่) รัน **Chunked Clean Loop with Safety Cap**: วนลูป `Queue.clean(0, 1000, 'failed')` บน queue เป้าหมาย โดยจำกัด Safety Cap สูงสุด 10,000 jobs ต่อครั้ง เพื่อไม่ให้ Redis event loop ถูกบล็อกนานเกินไปแม้จะรันนอก HTTP request แล้วก็ตาม
  - **Transparent Reporting:** เมื่อ job เสร็จ เก็บผลลัพธ์ `{ clearedCount: number, remainingFailed: number }` ไว้ให้ polling endpoint คืนค่า เพื่อให้ Frontend แสดง Toast Notification ชัดเจน (เช่น _"ล้างงานที่ล้มเหลวแล้ว 3,500 รายการ (คงเหลือ 0 รายการ)"_)
  - **Storage & Temp Artifact Independence:** การกวาดลบเฉพาะ BullMQ record ใน Redis ไม่กระทบไฟล์ Temp ใน Storage เนื่องจากไฟล์ชั่วคราวทั้งหมดถูกบริหารจัดการด้วย Two-Phase Upload และ `TmpCleanupService` (Cron 24h retention) ตาม ADR-016 อยู่แล้ว
- **ขอบเขตชัดเจน:** ลบเฉพาะ job สถานะ `failed` เท่านั้น ห้ามแตะ `active`/`waiting`/`delayed`/`completed`
- Permission: `system.manage_all` (เฉพาะ Superadmin)
- Audit: `@Audit('CLEAR_FAILED_JOBS', queueName)` — บันทึกทันทีตอน enqueue พร้อมอัปเดตจำนวน job ที่ถูกลบจริง (`clearedCount`) เมื่อ job เสร็จ

### D6: RBAC & Audit — ใช้ `system.manage_all` เดียวทุก Endpoint (ยืนยันซ้ำหลัง Grill-Me)

> **หมายเหตุจาก Review รอบ 2 (2026-08-24):** ฉบับร่างก่อนหน้าเคยเสนอ Tiered RBAC (`ai.view_telemetry` ให้ role "Operator/General Admin") แต่เมื่อตรวจสอบกับ CASL Ability จริง (`ability.factory.ts`) พบว่าระบบมีเพียง 5 roles จริง (Superadmin, Org Admin, Document Control, Viewer, Project Manager) ไม่มี "Operator/General Admin" — และการ grant สิทธิ์ดูข้อมูล infra ระดับ server (CPU/GPU/VRAM/Queue internals) ให้ role ที่ไม่ใช่ Superadmin ไม่ตรงกับลักษณะงาน (เป็น ops ระดับ server ไม่ใช่ business permission) จึงตัดสินใจ **ยกเลิก Tiered RBAC** และกลับไปใช้ `system.manage_all` เดียวสำหรับทุก endpoint ของ Control Center — สอดคล้องกับ endpoint อื่นทั้งหมดใน `admin/models/*`, `admin/health`, `admin/settings`

- ทุก endpoint ใหม่ (`host/metrics`, `vram/load`, `vram/unload`, `queues/:name/jobs`, `queues/:name/jobs/:id/retry`, `queues/:name/jobs/:id` DELETE, `queues/:name/clear-failed` POST, `queues/:name/clear-failed/:jobId` GET) ใช้ `RequirePermission('system.manage_all')` — **ไม่มีการเพิ่ม CASL permission/subject ใหม่**
- ทุก mutation (`load`, `unload`, `clear-failed`, `retry`, `delete-job`) ต้องมี `@Audit()` decorator ตาม ADR-016 §11 (AI Audit Trail) — ไม่มี exception

---

## 🔍 Impact Analysis

### Affected Components

| Component                          | Level     | Impact Description                                                                                                                                                                                                                                          | Required Action                                                                   |
| :--------------------------------- | :-------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- |
| **Infrastructure (Layer 4)**       | 🟡 Medium | เพิ่ม `node-exporter` container ใหม่                                                                                                                                                                                                                        | แก้ `04-ai/docker-compose.yml`, เปิด port `192.168.10.11:9100`                    |
| **Backend Service**                | 🔴 High   | เพิ่ม `NodeMetricsService` ใหม่, ขยาย `VramMonitorService` (load/unload + auto-eviction), ขยาย `AiQueueService` (job listing/retry/remove/clear-failed)                                                                                                     | สร้าง service ใหม่ + เพิ่ม method ใน service เดิม                                 |
| **Backend Service (Non-Additive)** | 🔴 High   | `AiQueueService.enqueue*()` methods ต้องเพิ่ม lock-check ก่อน `queue.add()` (D3 TOCTOU fix) — เป็นจุดเดียวที่แก้ของ "โค้ดเดิม" ไม่ใช่ endpoint ใหม่ล้วน                                                                                                     | เพิ่ม guard clause ใน `enqueue*()` ทุกตัวที่มีอยู่แล้ว + unit test กัน regression |
| **Backend Controller**             | 🔴 High   | เพิ่ม 8 endpoints ใหม่ (`host/metrics`, `models/:name/vram/load`, `models/:name/vram/unload`, `queues/:name/jobs`, `queues/:name/jobs/:id/retry`, `queues/:name/jobs/:id` DELETE, `queues/:name/clear-failed` POST, `queues/:name/clear-failed/:jobId` GET) | อัปเดต `AiController` + DTO validation                                            |
| **Backend Processor**              | 🟡 Medium | เพิ่ม case `clear-failed-jobs` ใหม่ใน `ai-batch.processor.ts` (chunked clean loop)                                                                                                                                                                          | เพิ่ม handler + unit test                                                         |
| **Frontend UI**                    | 🔴 High   | รวม VRAM card เข้า Ollama card, เพิ่ม host metrics card, เพิ่ม job drill-down (Drawer) + retry/delete/clear-failed actions                                                                                                                                  | อัปเดต `AiInfrastructureMonitoring.tsx`                                           |
| **RBAC/Audit**                     | 🟢 Low    | ใช้ `system.manage_all` เดียวทุก endpoint ไม่มี permission ใหม่ ไม่มี DB migration                                                                                                                                                                          | ตรวจสอบ `@Audit()` ครบทุก mutation                                                |
| **Concurrency Safety**             | 🔴 High   | ป้องกัน race กับ `ai-batch.processor.ts` automatic model switching ทั้งระดับ "รับคำสั่งใหม่" (global empty-queue guard) และระดับ "TOCTOU ระหว่าง transition" (Redis lock ใน `AiQueueService`)                                                               | เพิ่ม guard + lock ตาม D3                                                         |

---

## 📋 Version Dependency Matrix

| ADR         | Version | Dependency Type                                            | Status         |
| :---------- | :------ | :--------------------------------------------------------- | :------------- |
| **ADR-033** | 1.0     | Required (Active Model & OCR Runner baseline)              | ✅ Implemented |
| **ADR-041** | 1.0     | Required (Layer 4 exporter pattern, host `np-dms-lcbp3`)   | ✅ Implemented |
| **ADR-007** | 1.0     | Required (Error classification, destructive action safety) | ✅ Implemented |
| **ADR-016** | 1.0     | Required (RBAC + AI Audit Trail)                           | ✅ Implemented |
| **ADR-048** | 1.0     | Target (this ADR)                                          | 🔄 Proposed    |

## 🚀 Implementation Roadmap

การพัฒนาจะถูกแบ่งออกเป็น 2 Phases ตามข้อตกลง Grill-Me:

- **Phase 1 — Telemetry & Dashboard Consolidation (Observability Baseline):**
  - ติดตั้ง `node-exporter` ใน `04-ai/docker-compose.yml` (Port `:9100`)
  - พัฒนา `NodeMetricsService` (Background Poller `@Interval(10_000)` + Redis Cache + Cold Start Load Fallback + Heuristic Temp Resolution)
  - เพิ่ม Endpoint `GET /ai/admin/host/metrics` (permission `system.manage_all` เหมือน endpoint อื่น)
  - ปรับปรุง Frontend UI: เพิ่ม Host Metrics Card พร้อม Sparkline Mini-charts (แนวโน้ม 2-3 นาที), ยุบ VRAM Card รวมเข้ากับ Ollama Card (D2), เพิ่มปุ่ม Toggle Auto-refresh (10s) / Manual Refresh
- **Phase 2 — Active Controls & Queue Operations (Actionable Management):**
  - พัฒนา Real VRAM Load/Unload Endpoint (`POST /ai/admin/models/:name/vram/load` / `unload`) พร้อม Auto-Eviction Policy, Concurrency Guard (Active + Waiting) และ Redis Transition Mutex Lock (`ai:model:transitioning`) (สิทธิ์เฉพาะ Superadmin)
  - พัฒนา Queue Job Listing (`GET /ai/admin/queues/:name/jobs`), Single-Job Retry (`POST /ai/admin/queues/:name/jobs/:id/retry`), Single-Job Delete (`DELETE /ai/admin/queues/:name/jobs/:id`) และ Batch Clear Failed แบบ Async Job (`POST /ai/admin/queues/:name/clear-failed` enqueue + `GET .../clear-failed/:jobId` poll, ประมวลผลใน `ai-batch.processor.ts` พร้อม 10k safety cap)
  - พัฒนา Frontend UI: ปุ่ม Load/Unload พร้อม Confirmation Dialog (Cold-start warning), Slide-over Sheet (Drawer) สำหรับ Drill-down ดู Jobs รายตัว พร้อม Row Actions (Retry/Delete) และปุ่ม Bulk Clear Failed

---

## 🔄 Rollback & Recovery Plan

1. `node-exporter` เป็น container เพิ่มเข้ามาแบบ additive — หยุด/ลบ container ได้ทันทีโดยไม่กระทบ `nvidia-gpu-exporter`/`ollama-metrics`/Ollama ที่มีอยู่ (คนละ container)
2. Endpoint ใหม่ทั้ง 7 ตัวเป็น additive (ไม่ยุ่งกับ endpoint เดิม) — revert ได้ด้วยการลบ route โดยไม่กระทบ AI Console/Migration ที่ใช้ endpoint เดิมอยู่
3. **ข้อยกเว้นเดียวที่ไม่ additive:** lock-check ที่เพิ่มใน `AiQueueService.enqueue*()` (D3 TOCTOU fix) — หากมีปัญหา (เช่น lock ค้างเกิน TTL แล้วบล็อก enqueue จริงของ user) ให้ revert เฉพาะ guard clause นี้ (feature flag หรือ comment-out) โดยไม่ต้องแตะ endpoint อื่นที่เพิ่มใน ADR นี้
4. หาก concurrency guard (global empty-queue check) มีปัญหา (false positive บล็อกทั้งที่ queue ว่างจริง) ให้ปิดใช้งานปุ่ม Load/Unload ที่ frontend ชั่วคราวโดยไม่ต้อง revert backend
5. Clear Failed Jobs / Delete Job เป็น one-way operation (BullMQ `clean`/`remove` ลบถาวร) — ไม่มี rollback ระดับข้อมูล แต่ไม่กระทบ production data เพราะ scope เฉพาะ BullMQ job record ไม่ใช่ business data ใน MariaDB

---

## 📋 Consequences

### Positive

1. ✅ Admin เห็นภาพรวมสุขภาพ server ทั้งเครื่อง (CPU/GPU/VRAM/Queue) ในหน้าเดียว ไม่ต้อง SSH เข้าเครื่องหรือเปิด Redis CLI
2. ✅ ควบคุม VRAM residency ได้ตรงจุดก่อนรัน batch งานใหญ่ (เช่น Migration) แทนที่จะพึ่ง automatic switching อย่างเดียว
3. ✅ Debug batch queue ได้เร็วขึ้น (เห็น job รายตัว + ล้าง failed jobs เก่าได้เอง)
4. ✅ Reuse pattern telemetry/RBAC/audit เดิมทั้งหมด — ไม่เพิ่ม cognitive load ให้ทีม

### Negative

1. ❌ เพิ่ม container ใหม่ 1 ตัว (แม้เบา) — เพิ่มจุดที่ต้อง monitor อีกเล็กน้อย
2. ❌ Manual load/unload หากใช้ผิดจังหวะ (แม้มี guard) ยังอาจกระทบ response time ของ user ที่กำลังใช้ AI features อยู่ (โหลดโมเดลใหม่ใช้เวลา)
3. ❌ Clear Failed Jobs เป็น destructive และไม่มี undo — ต้องพึ่ง audit log อย่างเดียวถ้าต้องสืบย้อนหลัง

### Mitigation Strategies

- Concurrency guard (D3) ลด risk ข้อ 2 ได้เกือบทั้งหมด
- Audit log (D6) ครอบคลุม risk ข้อ 3 — เพียงพอสำหรับ traceability แม้ไม่มี undo
- Resource limit ของ `node-exporter` (D1) ทำให้ risk ข้อ 1 มีผลกระทบต่ำมาก

---

## 🔄 Review Cycle & Maintenance

### Review Schedule

- **Next Review:** 2027-02-24 (6 months from creation)
- **Review Type:** Triggered (เมื่อมี incident จาก manual load/unload หรือ clear-failed) หรือ Scheduled
- **Reviewers:** System Architect, AI Integration Lead

### Version History

| Version | Date       | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Status      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1.4     | 2026-08-24 | Grill-with-Docs Review Round 3 (verified against real CASL/RBAC code): reverted Tiered RBAC to single `system.manage_all` (invented `system.read`/`ai.view_telemetry` don't exist and no "Operator" role exists — only Superadmin/Org Admin/Document Control/Viewer/Project Manager); tied Auto-Eviction to same global empty-queue guard as Load/Unload; replaced invasive Transition Mutex Lock (would've touched all job-dispatch paths) with single-choke-point lock in `AiQueueService.enqueue*()` only; confirmed Retry/Delete-per-job is genuinely wanted scope (not accidental scope creep); Sparkline history moved to Redis (survives reload); Clear Failed Jobs changed from synchronous to async BullMQ job + polling (10k-job scale risk); flagged `Job.remove()` on `active` jobs doesn't kill in-flight worker — added mandatory confirmation dialog; clarified Cold Start = backend process boot, not host boot | 🔄 Proposed |
| 1.3     | 2026-08-24 | Deepened Grill-Me: Tiered RBAC Matrix (Operator vs Superadmin), Individual Job Retry/Delete Actions in Drawer, Auto-Eviction VRAM Policy, Sparkline Mini-Charts                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 🔄 Proposed |
| 1.2     | 2026-08-24 | Grill-Me Interview Alignment: Phased Roadmap (Phase 1 Telemetry/UI -> Phase 2 Controls), Slide-over Sheet UX for Queue Jobs, 10s auto-refresh interval with Pause/Play, Confirmation Dialog for VRAM Unload                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 🔄 Proposed |
| 1.1     | 2026-08-24 | Red Team QuizMe Refinement: D1 background poller + cold start + temp heuristics, D3 active/waiting guard + transition mutex lock, D5 batch clean loop + transparent response                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 🔄 Proposed |
| 1.0     | 2026-08-24 | Initial proposal — สร้างจาก grill-with-docs session เพื่อขยาย `/admin/ai/system` เป็น AI Engine Control Center                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 🔄 Proposed |

---

## Related ADRs

- [ADR-033: Active Model & OCR Runner Management](./ADR-033-active-model-and-ocr-management.md) — Automatic model switching ที่ D3 ต้อง guard ไม่ให้ race
- [ADR-041: Single-Host Server Consolidation](./ADR-041-server-consolidation.md) — Layer 4 telemetry pattern ที่ D1 ต่อยอด
- [ADR-043: AI Architecture — Current State](./ADR-043-ai-architecture-current-state.md) — จะต้อง restate ADR-048 เข้า §13 (Server Topology) เมื่อ Accepted
- [ADR-007: Error Handling Strategy](./ADR-007-error-handling-strategy.md) — Pattern การแจ้งเหตุผลเมื่อ block action

---

## References

- `frontend/components/admin/ai/AiInfrastructureMonitoring.tsx`
- `backend/src/modules/ai/ai.controller.ts`
- `backend/src/modules/ai/services/vram-monitor.service.ts`
- `backend/src/modules/ai/processors/ai-batch.processor.ts`
- `backend/src/modules/ai/ai-queue.service.ts`
- `specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/docker-compose.yml`
