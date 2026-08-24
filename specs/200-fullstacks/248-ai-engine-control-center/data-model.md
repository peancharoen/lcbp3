# Data Model & Schema: AI Engine Control Center (248-ai-engine-control-center)

**Feature**: `248-ai-engine-control-center`  
**Date**: 2026-08-24  
**Source ADR**: [ADR-048-ai-engine-control-center.md](../../06-Decision-Records/ADR-048-ai-engine-control-center.md)

---

## 1. Redis Key Architecture

The control center uses Redis exclusively for caching, rate limiting, locking, and rolling telemetry history (no MariaDB table migrations required per ADR-044).

| Redis Key | Type | TTL | Purpose |
| :--- | :--- | :--- | :--- |
| `ai:metrics:raw:last_cpu` | Hash / String | 30s | Raw CPU seconds per core and timestamp of previous scrape |
| `ai:metrics:host_summary` | JSON String | 30s | Latest computed host snapshot (CPU%, Memory, Temp, isEstimated) |
| `ai:metrics:host_history` | List (LPUSH/LTRIM 15) | None (Renewed on poll) | Rolling 15-sample array for sparkline charts |
| `ai:model:transitioning` | String | 15s | Mutex lock set during Ollama Load/Unload operations |
| `ai:clear_failed:job:<jobId>` | JSON String | 300s (5m) | Status and results of async BullMQ cleanup tasks |

---

## 2. In-Memory & API Data Types

### Host Metrics Snapshot (`HostMetricsDto`)

```typescript
export interface HostMetricsSnapshot {
  timestamp: string;
  cpu: {
    overallPercentage: number;
    coreCount: number;
    perCorePercentage: number[];
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercentage: number;
  };
  temperature: {
    cpuCelsius: number | null;
    sensorName: string | null;
  };
  isEstimated: boolean;
  history: Array<{
    timestamp: string;
    cpuPercentage: number;
    memoryPercentage: number;
    temperatureCelsius: number | null;
  }>;
}
```

### Consolidated Model VRAM Status (`ModelVramStatusDto`)

```typescript
export interface ConsolidatedModelStatus {
  modelName: string;
  canonicalName: 'np-dms-ai' | 'np-dms-ocr' | string;
  isActiveInCatalog: boolean;
  isLoadedInVram: boolean;
  vramUsageMb: number;
  vramSizeBytes: number;
  expiresAt: string | null;
}
```

### Queue Job Item Detail (`QueueJobItemDto`)

```typescript
export interface QueueJobItem {
  id: string;
  name: string;
  jobType: string;
  status: 'active' | 'waiting' | 'delayed' | 'completed' | 'failed';
  data: Record<string, unknown>;
  failedReason?: string;
  stacktrace?: string[];
  attemptsMade: number;
  createdAt: number;
  processedOn?: number;
  finishedOn?: number;
}
```

### Clear Failed Jobs Job Payload & Result

```typescript
export interface ClearFailedJobPayload {
  targetQueueName: string;
  requestedBy: string;
}

export interface ClearFailedJobResult {
  jobId: string;
  targetQueueName: string;
  clearedCount: number;
  remainingFailed: number;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  error?: string;
  completedAt?: string;
}
```
