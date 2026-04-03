# Task BE-AI-01: Pipeline Infrastructure Setup

**Phase:** Step 1 - AI Pipeline Foundation (n8n + PaddleOCR + Gemma 4)
**ADR Compliance:** ADR-018 (AI Boundary), ADR-019 (UUID Strategy)
**Priority:** 🔴 Critical - Foundation for all AI features

> **Context:** เป็นรากฐานสำคัญของระบบ Document Intelligence ตาม ADR-020 โดยต้องเป็นไปตามนโยบาย AI Isolation และใช้ Identifier ที่ถูกต้อง

---

## 📋 Implementation Tasks

### **AI-1.1: Infrastructure Setup (ADR-018 Compliance)**
- [ ] **Docker Environment on Admin Desktop (Desk-5439):**
  - ติดตั้ง Docker Compose สำหรับ n8n และ PaddleOCR
  - ตั้งค่า Network Isolation (LAN only, no public access)
  - ตรวจสอบ Hardware: RTX 2060 Super 8GB VRAM availability
- [ ] **n8n Service:**
  - Docker Compose service พร้อม Basic Authentication
  - Webhook endpoint: `/webhook/ai-processing`
  - Environment variables: `N8N_BASIC_AUTH_USER`, `N8N_BASIC_AUTH_PASSWORD`
- [ ] **Ollama Service:**
  - Pull model: `gemma:9b` (GPU optimized, higher accuracy)
  - API endpoint: `http://localhost:11434`
  - Health check: `GET /api/tags`
  - Memory requirement: Minimum 8GB VRAM for 9B model
  - ollama run gemma4:9b-q5_K_M / gemma4:9b-q4_K_M
  - สร้างไฟล์ %USERPROFILE%\.ollama\config
```config
# ใช้ GPU เป็นหลัก
gpu: true
num_gpu: 1

# เปิด KV cache เพื่อให้ตอบเร็วขึ้น
kv_cache: true

# จำกัด batch size ให้เหมาะกับ VRAM 8GB
gpu_batch_size: 512

# ปรับ num_thread ให้เหมาะกับ CPU 6–8 คอร์
num_thread: 6

# เปิด mmap เพื่อโหลดโมเดลเร็วขึ้น
mmap: true

# ปรับ max_seq_len ให้เหมาะกับงาน DMS
max_seq_len: 4096

# ปรับ temp ต่ำเพื่อให้ผลลัพธ์เสถียร
temperature: 0.2
```

- [ ] **PaddleOCR Service:**
  - Docker image: `paddlepaddle/paddle:latest-gpu`
  - Thai language support configuration
  - API endpoint design: `POST /ocr/extract`

### **AI-1.2: n8n Workflow Development**
- [ ] **Webhook Trigger Node:**
  - Input: `{ publicId: string, fileUrl: string, context: 'migration'|'ingestion' }`
  - Validation: Verify `publicId` format (UUIDv7) before processing
  - Idempotency check: Prevent duplicate processing
- [ ] **OCR Integration Node:**
  - HTTP Request to PaddleOCR service
  - Input: Binary file data
  - Output: `{ text: string, confidence: number, language: 'th'|'en' }`
  - Error handling: Retry logic + fallback to CPU OCR
- [ ] **Prompt Engineering Node:**
  - Function Node to construct Gemma 4 prompt
  - Template includes: Role definition, validation rules, JSON schema
  - Thai engineering context keywords
- [ ] **Gemma 4 LLM Node:**
  - HTTP Request to Ollama API
  - Model: `gemma:9b` (enhanced accuracy for Thai engineering documents)
  - Parameters: `temperature: 0.1`, `max_tokens: 2048`
  - Output validation: Ensure valid JSON response
  - Memory monitoring: Track VRAM usage during inference
- [ ] **Result Processing Node:**
  - Parse and validate AI response
  - Calculate confidence scores
  - Format for DMS Backend API callback
- [ ] **Callback to DMS:**
  - HTTP POST to NestJS webhook endpoint
  - Payload: `{ publicId, extractedData, confidence, processingTime }`
  - Authentication: Service account JWT

### **AI-1.3: Prompt Engineering for Thai Engineering Documents**
- [ ] **System Prompt Template:**
  ```prompt
  You are a Senior Document Controller for Laem Chabang Port Phase 3 construction project.

  TASK: Extract metadata from engineering documents with high accuracy.

  RULES:
  1. Extract: subject, document_date, discipline, drawing_reference, contract_number
  2. Validate consistency between content and metadata
  3. Return confidence score (0-100%) for each field
  4. Support Thai and English engineering terms
  5. Output MUST be valid JSON only

  OUTPUT FORMAT:
  {
    "subject": "string",
    "document_date": "YYYY-MM-DD",
    "discipline": "Civil|Mechanical|Electrical|Architectural",
    "drawing_reference": "string",
    "contract_number": "string",
    "confidence": {
      "overall": 0.95,
      "field_confidence": {...}
    }
  }
  ```
- [ ] **Thai Language Optimization:**
  - Engineering terms: "วิศวกรรมโยธา", "แบบรายละเอียด", "ขออนุมัติ", "แผนผัง"
  - Date format recognition: Thai Buddhist years (พ.ศ.)
  - Organization names: "ท่าเรือแหลมฉบัง", "ก.ท.ม.", "การท่าเรือฯ"
- [ ] **JSON Schema Validation:**
  - Zod schema for response validation
  - Required fields enforcement
  - Type checking and sanitization

### **AI-1.4: Integration Testing & Validation**
- [ ] **Test Case 1: Legacy Migration Flow:**
  - Input: Scanned RFA PDF + Excel metadata
  - Expected: Thai text extraction >90% accuracy
  - Validation: AI output matches Excel data
- [ ] **Test Case 2: Real-time Ingestion Flow:**
  - Input: New PDF upload from user
  - Expected: Response time <15 seconds
  - Validation: Structured JSON response
- [ ] **Performance Benchmarking:**
  - Target: <15 seconds per document
  - Memory usage monitoring on Admin Desktop
  - GPU utilization tracking
- [ ] **Security Validation:**
  - Verify no external network calls
  - Confirm AI services run in isolation
  - Test authentication between n8n and DMS

---

## ✅ Acceptance Criteria

1. **Pipeline Functionality:**
   - n8n successfully processes PDF → OCR → AI → JSON flow
   - Thai text extraction accuracy >90%
   - Gemma 4 returns valid JSON 100% of time

2. **Security Compliance (ADR-018):**
   - All services run on Admin Desktop only
   - No external network connections
   - Proper authentication between services

3. **Data Integrity:**
   - Extracted metadata matches document content >85%
   - Confidence scoring implemented and accurate
   - Idempotency prevents duplicate processing

4. **Performance:**
   - Processing time <20 seconds per document (gemma:9b)
   - GPU memory usage <8GB per document
   - System remains stable under load

---

## � Critical Rules (Non-Negotiable)

1. **ADR-018 Compliance:** AI services MUST run on Admin Desktop ONLY
2. **No Direct DB Access:** Pipeline communicates via DMS API only
3. **UUID Strategy:** All document references use `publicId` (UUIDv7)
4. **Thai Language Support:** Must handle Thai engineering documents
5. **Error Handling:** All failures must log to DMS audit system

---

## 📁 Related Specifications

- **ADR-018:** AI Boundary Policy - Physical isolation requirements
- **ADR-019:** Hybrid Identifier Strategy - UUID usage patterns
- **ADR-020:** AI Intelligence Integration - Overall architecture
- **03-05-n8n-migration-setup-guide.md:** n8n configuration details

---

## 📝 Implementation Notes

### Docker Compose Structure
```yaml
services:
  n8n:
    image: n8nio/n8n:latest
    ports: ["5678:5678"]
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}

  paddleocr:
    image: paddlepaddle/paddle:latest-gpu
    ports: ["8866:8866"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
              device_ids: ["0"] # RTX 2060 Super
    environment:
      - CUDA_VISIBLE_DEVICES=0
    shm_size: 2gb

  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
              device_ids: ["0"] # RTX 2060 Super
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - OLLAMA_MAX_LOADED_MODELS=1
      - OLLAMA_NUM_PARALLEL=2
    volumes:
      - ollama_data:/root/.ollama
    pull_policy: always

volumes:
  ollama_data:
```

### Hardware Requirements
- **GPU:** RTX 2060 Super 8GB VRAM (minimum for gemma:9b)
- **RAM:** 32GB system memory recommended
- **Storage:** 100GB SSD for models and temporary files
- **Network:** Gigabit LAN for file transfers

### Model Specifications
- **gemma:9b** - 9 billion parameters, optimized for Thai
- **VRAM Usage:** ~7-8GB for inference
- **Performance:** ~15-20 seconds per document
- **Accuracy:** Expected 90%+ for Thai engineering documents
