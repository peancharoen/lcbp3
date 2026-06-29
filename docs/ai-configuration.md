# AI Configuration Guide

**Version:** 1.0  
**Feature:** AI Model Revision (ADR-023A)  
**Last Updated:** 2026-05-15

---

## 1. Environment Variables (Backend)

The following environment variables control the AI Gateway behavior:

| Variable | Description | Default |
| --- | --- | --- |
| `AI_N8N_WEBHOOK_URL` | Endpoint URL of the n8n AI workflow | - |
| `AI_N8N_SERVICE_TOKEN` | Bearer token for n8n authentication | - |
| `AI_TIMEOUT_MS` | Max wait time for real-time extraction | `30000` |
| `AI_CONFIDENCE_HIGH` | Threshold for Auto-approve | `0.85` |
| `AI_CONFIDENCE_MID` | Threshold for Human Review | `0.60` |

---

## 2. Threshold Recalibration

Based on Phase 6 monitoring (AI Analytics), admins should recalibrate thresholds to balance between automation and accuracy.

### Metrics to Watch:
- **Human Override Rate:** If > 40%, the model might be extracting incorrect data or the `AI_CONFIDENCE_HIGH` is too low.
- **Rejection Rate:** If > 20%, consider improving the OCR or the prompt in n8n.
- **Avg. Confidence:** Helps identify document types where AI performs poorly.

### Recalibration Procedure:
1.  **Monitor:** Check the **AI Analytics** tab in the AI Staging page.
2.  **Evaluate:** If the **Override Rate** is high but **Confidence** is also high, it means the model is "confidently wrong".
3.  **Adjust:**
    - To reduce bad auto-approvals: **Increase** `AI_CONFIDENCE_HIGH`.
    - To reduce unnecessary human reviews: **Decrease** `AI_CONFIDENCE_MID` (only if the model is accurate).
4.  **Restart:** Apply new values to environment variables and restart the backend service.

---

## 3. BullMQ Queue Management

AI tasks are processed using BullMQ:
- `ai-realtime`: High priority, used for UI extraction and suggestions.
- `ai-batch`: Lower priority, used for legacy migration and embedding.

### Retry Strategy:
- **Extraction:** 3 retries with exponential backoff (2s).
- **Embedding:** 5 retries with exponential backoff (5s).

---

## 4. Security & Permissions

All AI endpoints are protected by CASL:
- `ai.extract`: Permission to use real-time extraction.
- `ai.migration_manage`: Permission to review and approve staging records.
- `ai.read_analytics`: Permission to view AI performance metrics.
- `ai.delete_audit`: Permission to delete audit logs (System Admin only).
