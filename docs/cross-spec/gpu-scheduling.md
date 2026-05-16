# Cross-Spec: GPU Resource Coordination

**Date**: 2026-05-16  
**Hardware**: RTX 2060 Super 8GB (Desk-5439)  
**Target Peak**: ~4.5GB VRAM  
**Document**: GPU scheduling strategy for AI workloads

---

## GPU Workload Overview

| Feature | Queue | GPU Usage | Duration | Frequency |
|---------|-------|-----------|----------|-----------|
| AI Model Revision | ai-realtime | High (gemma4:e4b) | 5-30s | On user action |
| AI Model Revision | ai-batch | High (gemma4:e4b) | 30-120s | Background |
| RFA Approval | rfa-reminders | None | - | - |
| RFA Approval | rfa-distribution | None | - | - |

---

## Scheduling Strategy

### 1. Time-Based Scheduling

```
Peak Hours (09:00-18:00):
├── ai-realtime: ACTIVE (user requests)
└── ai-batch: PAUSED (defer to off-peak)

Off-Peak Hours (18:00-09:00):
├── ai-realtime: ACTIVE (reduced load)
└── ai-batch: ACTIVE (background processing)
```

### 2. Dynamic Pause/Resume

```typescript
// AiRealtimeProcessor auto-manages ai-batch
@Processor(QUEUE_AI_REALTIME, { concurrency: 1 })
export class AiRealtimeProcessor {
  @OnWorkerEvent('active')
  async pauseBatch() {
    await this.aiBatchQueue.pause();
    this.logger.log('Paused ai-batch for realtime job');
  }

  @OnWorkerEvent('completed')
  async resumeBatch() {
    const activeCount = await this.aiRealtimeQueue.getActiveCount();
    if (activeCount === 0) {
      await this.aiBatchQueue.resume();
      this.logger.log('Resumed ai-batch (no active realtime jobs)');
    }
  }
}
```

### 3. VRAM Budget Management

| Model | VRAM Usage | Context |
|-------|------------|---------|
| gemma4:e4b Q8_0 | ~4.5GB peak | Main inference |
| nomic-embed-text | ~0.5GB | Embedding only |
| **Total Budget** | **~5GB** | Safety margin 3GB |

### 4. Contention Prevention

- **Single Model Loading**: Only gemma4:e4b loaded at a time
- **No Concurrent GPU Jobs**: concurrency=1 for both AI queues
- **Memory Cleanup**: Explicit cleanup after each job
- **Queue Draining**: ai-batch pauses when ai-realtime active

---

## Monitoring Commands

```bash
# Monitor GPU usage on Desk-5439
watch -n 1 nvidia-smi

# Check Ollama model status
curl http://192.168.10.100:11434/api/ps

# Monitor queue states
redis-cli KEYS "bull:*:meta"
```

---

## Fallback Strategy

If GPU unavailable:
1. ai-realtime: Return "AI service temporarily unavailable"
2. ai-batch: Queue jobs with delay, retry every 5 minutes
3. RFA features: Unaffected (no GPU usage)

---

## Verification Checklist

- [x] ai-realtime has auto-pause for ai-batch
- [x] concurrency=1 for both AI queues
- [x] VRAM monitoring in place
- [x] Fallback handling for GPU unavailability
- [x] RFA queues don't use GPU
