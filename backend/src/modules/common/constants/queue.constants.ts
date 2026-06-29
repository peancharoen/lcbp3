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

/** Queue สำหรับ Legacy Document Migration ผ่าน AI Pipeline (ADR-023) */
export const QUEUE_AI_INGEST = 'ai-ingest';

/** Queue สำหรับ AI งาน interactive ที่ต้องมาก่อน batch jobs (ADR-023A) */
export const QUEUE_AI_REALTIME = 'ai-realtime';

/** Queue สำหรับ AI งาน batch เช่น OCR, extract metadata และ embedding (ADR-023A) */
export const QUEUE_AI_BATCH = 'ai-batch';

/** Queue สำหรับ RAG Query ที่ต้องจำกัด concurrency บน Desk-5439 (ADR-023) */
export const QUEUE_AI_RAG = 'ai-rag-query';

/** Queue สำหรับลบ vector ใน Qdrant แบบ asynchronous (ADR-023 FR-008) */
export const QUEUE_AI_VECTOR_DELETION = 'ai-vector-deletion';
