# Research: AI Engine Control Center (248-ai-engine-control-center)

**Feature**: `248-ai-engine-control-center`  
**Date**: 2026-08-24  
**Source ADR**: [ADR-048-ai-engine-control-center.md](../../06-Decision-Records/ADR-048-ai-engine-control-center.md)

---

## 1. Host Telemetry Scrape & Calculation via `node-exporter`

### Problem
Prometheus `node-exporter` outputs monotonic raw counters (e.g. `node_cpu_seconds_total{cpu="0",mode="idle"}`). Calculating instantaneous CPU percentage requires taking the difference ($\Delta$) between two samples over time $\Delta t$. Doing two scrapes with a 1-second `sleep` during an incoming HTTP request would introduce unacceptable latency (>1s) and degrade user experience.

### Decision
- **Architecture**: Implement `NodeMetricsService` in NestJS with a background poller (`@Interval(10_000)` running every 10 seconds).
- **Storage**: Store the raw previous counter in Redis `ai:metrics:raw:last_cpu` and computed instantaneous summary in `ai:metrics:host_summary` (TTL 30s).
- **Rolling Sparkline History**: `LPUSH` each computed snapshot into Redis List `ai:metrics:host_history` and `LTRIM` to keep the 15 latest points (representing 2.5 minutes of history).
- **Cold-Start Fallback**: During the initial 10 seconds after backend restart, compute estimated load using the gauge metric `node_load1` ($\min(100, (\text{node\_load1} / \text{Core Count}) \times 100)$) with `isEstimated: true`.
- **Response Time**: `GET /ai/admin/host/metrics` reads from Redis cache and returns in `< 5ms`.

---

## 2. Hardware Temperature Sensor Heuristics

### Problem
Linux hosts report temperature across diverse subsystems (`coretemp`, `k10temp`, `zenpower`, ACPI thermal zones). Relying on a fixed metric name causes missing or inaccurate data (e.g., displaying NVMe or Motherboard temp instead of CPU temp).

### Decision
Implement priority-based sensor resolution:
1. `node_hwmon_temp_celsius` matching `chip=~"coretemp|k10temp|zenpower|cpu_thermal|soc_thermal"` and sensor labels matching `Package id 0|Tctl|Tdie|temp1`.
2. Peak CPU Core temperature (`max(Core 0..N)`).
3. ACPI thermal zone `node_thermal_zone_temp{type=~"cpu-thermal|acpitz|x86_pkg_temp"}`.
4. Fallback to `null` with graceful `N/A` display on UI.

---

## 3. Concurrency Guard & TOCTOU Mutex Lock (D3)

### Problem
When Superadmin manually loads/unloads a model, Ollama takes 1–3 seconds to evict or load weights into VRAM. If incoming requests arrive during this window, or if a batch worker is currently running model-switching (`ai-batch.processor.ts`), model thrashing or crashes occur.

### Decision
- **Global Empty-Queue Check**: Before triggering Load/Unload, verify that both `ai-realtime` and `ai-batch` have `activeCount === 0` and `waitingCount === 0`. If jobs exist, reject with `409 Conflict`.
- **Redis Transition Mutex Lock**: Set `ai:model:transitioning` with TTL 15s before calling Ollama.
- **Single Choke-Point Enforcement**: In `AiQueueService.enqueue*()` methods (the single entry point for all queueing in the backend), check `ai:model:transitioning`. If locked, throw `SystemException` (`503 Service Unavailable`) before `queue.add()` is called. No modifications to `ai-batch.processor.ts` worker loop are needed.

---

## 4. Bulk Failed Job Cleanup & Async Execution (D5)

### Problem
A large batch failure could leave 5,000–10,000 failed jobs in Redis. Calling `Queue.clean()` synchronously in an HTTP handler risks request timeouts and blocks the Node.js/Redis event loop.

### Decision
- Enqueue an async cleanup job `clear-failed-jobs` into `ai-batch` queue and respond immediately with `{ jobId, status: 'queued' }`.
- Provide polling endpoint `GET /ai/admin/queues/:queueName/clear-failed/:jobId`.
- In `ai-batch.processor.ts`, process cleanup in chunks of 1,000 using `Queue.clean(0, 1000, 'failed')` up to a safety cap of 10,000 jobs per run.
- Report exact `{ clearedCount, remainingFailed }` upon completion.
