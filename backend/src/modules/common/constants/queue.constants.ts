// File: src/modules/common/constants/queue.constants.ts
// Queue name constants สำหรับ BullMQ (ADR-008)
// รวม queue ทั้งหมดของระบบไว้ที่เดียว

// ─── Existing Queues ───────────────────────────────────────────────────────
export const QUEUE_NOTIFICATIONS = 'notifications';
export const QUEUE_WORKFLOW_EVENTS = 'workflow-events';

// ─── New Queues (Feature: 1-rfa-approval-refactor) ────────────────────────

/** Queue สำหรับ Auto-Reminders และ Escalation (T043-T047) */
export const QUEUE_REMINDERS = 'reminders';

/** Queue สำหรับ Distribution Matrix — กระจายเอกสารหลังอนุมัติ (T054-T056) */
export const QUEUE_DISTRIBUTION = 'distribution';

/** Queue สำหรับ Veto Override Notifications (T068.5) */
export const QUEUE_VETO_NOTIFICATIONS = 'veto-notifications';

/** Queue สำหรับ AI งาน interactive ที่ต้องมาก่อน batch jobs (ADR-023A) */
export const QUEUE_AI_REALTIME = 'ai-realtime';

/** Queue สำหรับ AI งาน batch เช่น OCR, extract metadata และ embedding (ADR-023A) */
export const QUEUE_AI_BATCH = 'ai-batch';

/**
 * Queue สำหรับ RAG attachment operations (ingest, metadata sync, cleanup, retention)
 * แยกจาก ai-batch เพื่อป้องกัน job ผิด type ถูก claim โดย processor ผิด (B13 fix)
 * — RAG processors มี WorkerHost หลายตัวบน queue เดียวกันทำให้ BullMQ ส่ง job
 * ไปยัง processor ผิดแล้ว complete ทันทีโดยไม่ process
 */
export const QUEUE_AI_RAG_INGEST = 'ai-rag-ingest';

/** Queue สำหรับ RAG Query ที่ต้องจำกัด concurrency บน Desk-5439 (ADR-023) */
export const QUEUE_AI_RAG = 'ai-rag-query';

/** Queue สำหรับลบ vector ใน Qdrant แบบ asynchronous (ADR-023 FR-008) */
export const QUEUE_AI_VECTOR_DELETION = 'ai-vector-deletion';

/** Job names สำหรับ RAG Attachment generation lifecycle (ai-rag-ingest queue) */
export const JOB_RAG_ATTACHMENT_INGEST = 'rag-attachment-ingest';
export const JOB_RAG_METADATA_SYNC = 'rag-metadata-sync';
export const JOB_RAG_GENERATION_CLEANUP = 'rag-generation-cleanup';

/** Job names สำหรับ ai-batch queue */
export const JOB_OCR = 'ocr';
export const JOB_OCR_EXTRACT = 'ocr-extract';
export const JOB_EXTRACT_METADATA = 'extract-metadata';
export const JOB_AI_SUGGEST = 'ai-suggest';
export const JOB_RAG_QUERY = 'rag-query';
export const JOB_EMBED_DOCUMENT = 'embed-document';
export const JOB_SANDBOX_RAG = 'sandbox-rag';
export const JOB_SANDBOX_EXTRACT = 'sandbox-extract';
export const JOB_SANDBOX_OCR_ONLY = 'sandbox-ocr-only';
export const JOB_SANDBOX_AI_EXTRACT = 'sandbox-ai-extract';
export const JOB_SANDBOX_RAG_PREP = 'sandbox-rag-prep';
export const JOB_MIGRATE_DOCUMENT = 'migrate-document';
export const JOB_RAG_PREPARE = 'rag-prepare';
export const JOB_LEGACY_AI_ENRICHMENT = 'legacy-ai-enrichment';
export const JOB_LEGACY_OCR_BATCH_PHASE = 'legacy-ocr-batch-phase';
export const JOB_LEGACY_AI_METADATA_ONLY = 'legacy-ai-metadata-only';
export const JOB_CLEAR_FAILED_JOBS = 'clear-failed-jobs';

/** Job names สำหรับ ai-vector-deletion queue */
export const JOB_DELETE_DOCUMENT_VECTORS = 'delete-document-vectors';

/** Queue สำหรับ bulk operations (cancel/tag/export) แบบ durable (Feature 253) */
export const QUEUE_BULK_OPERATIONS = 'bulk-operations';
