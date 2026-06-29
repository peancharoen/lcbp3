# Research: Intent Classification System

**Feature**: 224-intent-classification  
**Date**: 2026-05-19  
**Research Topics**: Redis Caching, Ollama Integration, Semaphore Pattern, Regex Validation

---

## Topic 1: Redis Cache Strategy สำหรับ Intent Patterns

### Decision
ใช้ Redis Key `ai:intent:patterns:active` เก็บ JSON Array ของ Active Patterns เรียงตาม priority ASC พร้อม TTL 300 วินาที (5 นาที)

### Rationale
- **Hit Rate**: 70-80% ของ queries ใช้ Pattern Match → Cache ช่วยลด DB Load มาก
- **Freshness**: TTL 5 นาทีเป็นจุดสมดุลระหว่าง Performance และ Configurability — Admin แก้ Pattern แล้วรอไม่เกิน 5 นาที
- **Simplicity**: Single Key ง่ายกว่า Hash หรือ Multiple Keys — Invalidate ทั้งหมดพร้อมกัน

### Alternatives Considered
| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| Hash per Intent | Granular invalidation | Complex logic, หลาย keys | ❌ Rejected |
| No Cache (Query DB ทุกครั้ง) | Always fresh | Latency 50-100ms ทุก request | ❌ Rejected |
| Single Key JSON (เลือก) | Simple, atomic | Invalidate ทั้งหมด | ✅ Selected |

### Implementation Pattern
```typescript
// Cache Service
class IntentPatternCache {
  private readonly CACHE_KEY = 'ai:intent:patterns:active';
  private readonly TTL = 300; // 5 minutes

  async getPatterns(): Promise<IntentPattern[]> {
    const cached = await redis.get(this.CACHE_KEY);
    if (cached) return JSON.parse(cached);
    
    const patterns = await this.queryDb(); // ORDER BY priority ASC
    await redis.setex(this.CACHE_KEY, this.TTL, JSON.stringify(patterns));
    return patterns;
  }

  async invalidate(): Promise<void> {
    await redis.del(this.CACHE_KEY);
  }
}
```

---

## Topic 2: Ollama HTTP API Integration

### Decision
ใช้ Ollama HTTP API (POST /api/generate) โดยตรงผ่าน axios — ไม่ใช้ Library ที่ซับซ้อน

### Rationale
- **Simple**: Ollama API เป็น HTTP JSON ที่เรียบง่าย — ไม่ต้อง wrapper
- **Control**: ควบคุม system prompt, temperature, timeout ได้เต็มที่
- **Semaphore**: ต้องควบคุม concurrency เองอยู่แล้ว — axios + p-limit เพียงพอ

### API Specification
```
POST http://192.168.10.10:11434/api/generate
Content-Type: application/json

{
  "model": "gemma4:e4b",
  "system": "คุณเป็นตัวจำแนกคำสั่ง (Intent Classifier)...",
  "prompt": "สรุปเอกสารนี้",
  "stream": false,
  "options": {
    "temperature": 0.1,
    "num_predict": 50
  }
}
```

### Response Parsing
```typescript
interface OllamaResponse {
  response: string; // JSON string: {"intent":"SUMMARIZE_DOCUMENT","confidence":0.95}
  done: boolean;
}

// Parse และ Validate
const result = JSON.parse(response.response);
if (!result.intent || typeof result.confidence !== 'number') {
  throw new ClassificationError('Invalid LLM response format');
}
```

### Timeout & Error Handling
- **Timeout**: 5000ms (5 วินาที) — หากเกินให้ถือว่า LLM ไม่ว่าง
- **Retry**: ไม่ retry อัตโนมัติ — ใช้ FALLBACK intent แทน
- **Circuit Breaker**: v1 ไม่ต้องมี — ใช้ Semaphore + Timeout พอ

---

## Topic 3: Semaphore Pattern สำหรับ LLM Concurrency

### Decision
ใช้ `p-limit` library (already popular) หรือ RxJS `concatMap` กับ buffer สำหรับ Semaphore max 3 concurrent LLM calls

### Rationale
- **GPU Conservation**: RTX 2060 Super 8GB ใช้ร่วมกับ RAG, OCR, Embedding — ต้องจำกัด LLM concurrent
- **Simple**: p-limit เป็น wrapper ที่ clean รอบ Promise — ไม่ต้องจัดการ queue เอง

### Implementation Pattern (p-limit)
```typescript
import pLimit from 'p-limit';

@Injectable()
export class IntentClassifierService {
  private readonly llmLimit = pLimit(3); // Max 3 concurrent

  async classifyWithFallback(query: string): Promise<ClassificationResult> {
    // Pattern Match First
    const patternResult = await this.patternMatch(query);
    if (patternResult) return patternResult;

    // LLM Fallback with Semaphore
    return this.llmLimit(() => this.llmClassify(query));
  }

  private async llmClassify(query: string): Promise<ClassificationResult> {
    try {
      const response = await this.callOllama(query);
      return this.parseAndValidate(response);
    } catch (error) {
      return {
        intentCode: 'FALLBACK',
        confidence: 0,
        method: 'llm_error',
        params: { error: error.message }
      };
    }
  }
}
```

### Overflow Behavior
หากมีการเรียกเกิน 3 concurrent:
- Request ที่ 4+ จะถูก queue โดย p-limit (รอจนกว่ามี slot ว่าง)
- หาก queue ยาวเกินไป → ใช้ timeout + return FALLBACK

---

## Topic 4: Regex Validation ใน TypeORM/Class-Validator

### Decision
ใช้ Class-Validator `@IsString()` + custom validation ใน Service Layer สำหรับ Regex Patterns

### Rationale
- **TypeORM**: ไม่มี built-in regex validation สำหรับ column value
- **Class-Validator**: `@Matches()` ใช้สำหรับ validate input — ไม่ใช่สำหรับ validate ว่า regex ที่ user ใส่มา valid หรือไม่
- **Custom**: ต้องใช้ `new RegExp(pattern)` ใน try-catch เพื่อตรวจสอบ

### Implementation Pattern
```typescript
// DTO
export class CreateIntentPatternDto {
  @IsEnum(['keyword', 'regex'])
  patternType: 'keyword' | 'regex';

  @IsString()
  @MaxLength(255)
  patternValue: string;
}

// Service Validation
private validateRegex(pattern: string): void {
  try {
    new RegExp(pattern);
  } catch (error) {
    throw new BadRequestException(`Invalid regex pattern: ${pattern}`);
  }
}

async createPattern(dto: CreateIntentPatternDto): Promise<IntentPattern> {
  if (dto.patternType === 'regex') {
    this.validateRegex(dto.patternValue);
  }
  // ... save to DB
}
```

---

## Research Summary

| Topic | Decision | Key Implementation |
|-------|----------|-------------------|
| Redis Cache | Single Key JSON | `ai:intent:patterns:active`, TTL 300s |
| Ollama API | Direct HTTP (axios) | POST /api/generate, timeout 5000ms |
| Semaphore | p-limit(3) | Max 3 concurrent LLM calls |
| Regex Validation | Custom Service | `new RegExp()` in try-catch |

**พร้อมดำเนินการ Phase 1: Design**
