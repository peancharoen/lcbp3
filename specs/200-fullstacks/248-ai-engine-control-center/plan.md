# Implementation Plan: AI Engine Control Center (248-ai-engine-control-center)

**Feature ID**: `248-ai-engine-control-center`  
**Date**: 2026-08-24  
**Spec**: [spec.md](./spec.md)  
**Related ADR**: [ADR-048-ai-engine-control-center.md](../../06-Decision-Records/ADR-048-ai-engine-control-center.md)

---

## Summary

Evolve the `/admin/ai/system` monitoring dashboard into an active **AI Engine Control Center**. The implementation is structured into two sequential phases:
- **Phase 1 (Observability & UI Consolidation)**: Deploy `node-exporter` in Layer 4 Telemetry (`:9100`), implement backend `NodeMetricsService` (10s background poller + Redis cache + sparkline list + heuristic temp resolution), expose `GET /ai/admin/host/metrics`, and update frontend UI (Host Metrics Card + combined Ollama/VRAM table + 10s auto-refresh).
- **Phase 2 (Active Controls & Queue Operations)**: Implement VRAM Load/Unload endpoints with global empty-queue guard, auto-eviction, and `AiQueueService` enqueue mutex lock; implement BullMQ job inspection (`GET /queues/:name/jobs`), single-job retry/delete actions, and chunked async failed-job cleanup; build the frontend slide-over drawer and confirmation dialogs.

---

## Technical Context

**Language/Version**: TypeScript 5.7+ (Node.js 22 LTS, NestJS 11, Next.js 16 App Router)  
**Primary Dependencies**: `@nestjs/bullmq`, `bullmq`, `ioredis`, `@tanstack/react-query`, `lucide-react`, `prom/node-exporter:v1.8.2`  
**Storage**: Redis (cache, locking, queues) + MariaDB 11.8 (no schema migrations required per ADR-044)  
**Testing**: Jest unit/integration tests (`*.spec.ts`)  
**Target Platform**: Linux server `np-dms-lcbp3` (192.168.10.11) + Docker Compose  
**Project Type**: Fullstack Web Application (`backend/` + `frontend/` + `specs/04-Infrastructure-OPS/`)  
**Performance Goals**: `GET /ai/admin/host/metrics` response time `< 5ms` from Redis; BullMQ clean loop handling up to 10,000 jobs in `< 5s`.  
**Constraints**: Zero `any`, zero `console.log`, zero schema migrations (ADR-044), CASL `system.manage_all` guard, and full `@Audit()` decorators.

---

## Constitution Check

| Principle / Rule | Requirement | Compliance Status |
| :--- | :--- | :--- |
| **ADR-019 UUID** | `publicId` strings only, no `parseInt` | ✅ Compliant (All job / model params use strings) |
| **ADR-044 Schema** | No TypeORM migrations; Redis-only storage | ✅ Compliant (No DB table additions needed) |
| **ADR-016 Security** | CASL `system.manage_all` + `@Audit()` | ✅ Compliant (Enforced on all 8 endpoints) |
| **ADR-007 Error Handling** | Layered errors, `userMessage` on 409/503 | ✅ Compliant (Empty-queue & mutex error format) |
| **ADR-008 BullMQ** | Background job execution for heavy tasks | ✅ Compliant (Async cleanup via `ai-batch` worker) |
| **ADR-033/034 AI Boundary** | Ollama on-prem runtime control | ✅ Compliant (Direct keep_alive generate calls) |

---

## Project Structure

### Documentation (this feature)

```text
specs/200-fullstacks/248-ai-engine-control-center/
├── spec.md              # Feature specification
├── plan.md              # This technical plan
├── research.md          # Technical research & decisions
├── data-model.md        # Redis schemas & TypeScript types
├── quickstart.md        # Verification & test commands
├── contracts/           # API interface contracts
│   ├── host-metrics.contract.ts
│   ├── vram-control.contract.ts
│   └── queue-control.contract.ts
├── checklists/
│   └── requirements.md  # Spec validation checklist
└── tasks.md             # Actionable task list
```

### Source Code Layout

```text
specs/04-Infrastructure-OPS/04-00-docker-compose/np-dms-lcbp3/04-ai/
└── docker-compose.yml                       # Add node-exporter container

backend/
└── src/modules/ai/
    ├── dto/
    │   ├── host-metrics.dto.ts              # [NEW] Host metrics response DTO
    │   └── queue-jobs.dto.ts                # [NEW] Queue jobs & cleanup DTOs
    ├── services/
    │   ├── node-metrics.service.ts          # [NEW] Background poller & metrics parser
    │   └── vram-monitor.service.ts          # [MODIFY] Add load/unload & auto-eviction
    ├── processors/
    │   └── ai-batch.processor.ts            # [MODIFY] Add clear-failed-jobs async handler
    ├── ai-queue.service.ts                  # [MODIFY] Add enqueue mutex check + job list/retry/delete
    ├── ai.controller.ts                     # [MODIFY] Add 8 control center endpoints
    └── ai.module.ts                         # [MODIFY] Register NodeMetricsService

frontend/
├── components/admin/ai/
│   ├── AiInfrastructureMonitoring.tsx       # [MODIFY] Dashboard container + 10s auto-refresh
│   ├── HostMetricsCard.tsx                  # [NEW] CPU, RAM, Temp with Sparkline mini-charts
│   ├── CombinedOllamaEngineCard.tsx         # [NEW] Consolidated Ollama & VRAM model table
│   └── QueueJobDrawer.tsx                   # [NEW] Slide-over Sheet for BullMQ jobs
└── services/
    └── admin-ai.service.ts                  # [MODIFY] Add API client methods
```

---

## Phased Implementation Strategy

### Phase 1: Telemetry & Observability Baseline
1. **Docker Compose**: Add `node-exporter` service to `04-ai/docker-compose.yml` (Port `192.168.10.11:9100`).
2. **Backend**: Implement `NodeMetricsService` (10s `@Interval` poller, Redis cache `ai:metrics:host_summary`, list `ai:metrics:host_history`, heuristic sensor resolution, cold-start estimation).
3. **Backend API**: Add `GET /ai/admin/host/metrics` in `AiController` with `@RequirePermission('system.manage_all')`.
4. **Frontend UI**: Create `HostMetricsCard.tsx` with SVG Sparklines, merge VRAM table into Ollama card, implement 10s auto-refresh with pause/manual controls.

### Phase 2: Active Controls & Queue Operations
1. **Backend VRAM Control**: Implement `loadModelVram` and `unloadModelVram` in `VramMonitorService` with auto-eviction policy and Ollama `keep_alive` calls.
2. **Backend Concurrency Guard & Lock**: Add global empty-queue validation and single choke-point check in `AiQueueService.enqueue*()` using Redis lock `ai:model:transitioning`.
3. **Backend Queue Actions**: Implement `getQueueJobs`, `retryJob`, `deleteJob`, and async `enqueueClearFailed` + polling in `AiQueueService` and `ai-batch.processor.ts`.
4. **Backend API**: Expose `/vram/load`, `/vram/unload`, `/queues/:name/jobs`, `/jobs/:id/retry`, `/jobs/:id` DELETE, `/clear-failed` POST, and `/clear-failed/:jobId` GET in `AiController`.
5. **Frontend UI**: Add Load/Unload buttons with Confirmation Dialog (cold-start warning) in Ollama card; build `QueueJobDrawer.tsx` (tabs, pagination, retry/delete row actions, bulk clear failed button).
