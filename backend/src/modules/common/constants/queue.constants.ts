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
