# SC-002 Accuracy Report — C2-2567 Migration

> Generated: 2026-09-16T08:20:58.722Z | Batch: BATCH-C2-2567-005 | Golden Set v2.0.0

## 1. Golden Set Results (5 docs — human-verified)

| Document | Expected | Actual | Match | Confidence | OCR Quality | Human Review | AI Status |
|----------|----------|--------|-------|------------|-------------|--------------|-----------|
| CHEC-LCP-C2-O-24-0009 | RFA | RFA | ✅ | 0.950 (min 0.85) | 0.800 (min 0.8) | No | DONE |
| CHEC-LCP-C2-O-24-0010 | RFA | RFA | ✅ | 0.920 (min 0.8) | 0.850 (min 0.7) | No | DONE |
| ผรม.2-คคง.-0025-2567 | TRANSMITTAL | TRANSMITTAL | ✅ | 0.950 (min 0.85) | 0.950 (min 0.7) | No | DONE |
| ผรม.2-คคง.-0049-2567 | RFA | RFA | ✅ | 0.950 (min 0.85) | 0.950 (min 0.8) | No | DONE |
| ผรม.2-คคง.-67091804 | RFA | TRANSMITTAL | ❌ | 0.950 (min 0.8) | 0.850 (min 0.8) | No | DONE |

**Classification Accuracy**: 4/5 (80.0%)
- Correct: 4, Incorrect: 1, Unavailable: 0

## 2. Full Population Stats (C2-2567 Migration)

**Total**: 247 | **DONE**: 226 | **FAILED**: 21 | **WAITING**: 0 | **RUNNING**: 0 | **PENDING**: 0

### 2.1 Confidence Distribution

| Bucket | Count |
|--------|-------|
| 0.0-0.3 | 21 |
| 0.3-0.5 | 0 |
| 0.5-0.7 | 0 |
| 0.7-0.85 | 9 |
| 0.85-1.0 | 217 |
| **Null/NA** | 0 |
| **Mean** | 0.846 |
| **Median** | 0.950 |

### 2.2 Threshold Compliance (ADR-023A defaults: confidence ≥ 0.85, OCR quality ≥ 0.7)

- Met confidence threshold: 217/247 (87.9%)
- Met OCR quality threshold: 223/247 (90.3%)
- Met both: 214/247
- Met neither: 21/247
- Human review required: 21/247 (8.5%)

### 2.3 Failure Analysis

- Total failures: 21
- OCR failed: 19
- LLM failed: 0
- Schema validation failed: 0
- No PDF: 0
- Other: 2

### 2.4 Classification by Type (full population — no ground truth)

| Type | Total | Correct | Incorrect |
|------|-------|---------|-----------|
| TRANSMITTAL | 70 | 70 | 0 |
| RFA | 138 | 138 | 0 |
| LETTER | 34 | 34 | 0 |
| EMAIL | 1 | 1 | 0 |
| INSTRUCTION | 1 | 1 | 0 |
| RFI | 2 | 2 | 0 |
| NOTICE | 1 | 1 | 0 |

## 3. Threshold Recalibration Recommendations (ADR-023A)

| Metric | Current | Observed | Recommendation | Rationale |
|--------|---------|----------|----------------|-----------|
| confidence_threshold | 0.85 (ADR-023A default) | mean=0.846, accuracy=100.0% | พิจารณาลด threshold เป็น 0.75 | accuracy ปานกลาง — ลด threshold เพื่อลด false negative โดยให้ human review ตรวจสอบ |

---

> **หมายเหตุ**: ความแม่นยำของ full population ไม่สามารถวัดได้โดยตรงเพราะไม่มี human-verified ground truth สำหรับทุก record — ใช้ golden set (5 docs) เป็นหลัก และใช้ full population สำหรับ confidence/OCR quality distribution และ failure analysis
