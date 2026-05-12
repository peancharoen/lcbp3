// File: src/modules/common/enums/review.enums.ts
// Shared enums สำหรับ RFA Approval Refactor (Feature: 1-rfa-approval-refactor)

// ─── Review Task Status ────────────────────────────────────────────────────
export enum ReviewTaskStatus {
  PENDING = 'PENDING',          // รอดำเนินการ
  IN_PROGRESS = 'IN_PROGRESS',  // กำลังตรวจสอบ
  COMPLETED = 'COMPLETED',      // เสร็จสิ้น (มีผลลัพธ์)
  DELEGATED = 'DELEGATED',      // ถูกมอบหมายให้ผู้อื่น
  EXPIRED = 'EXPIRED',          // เกินกำหนด
  CANCELLED = 'CANCELLED',      // ยกเลิก
}

// ─── Response Code Category ────────────────────────────────────────────────
export enum ResponseCodeCategory {
  ENGINEERING = 'ENGINEERING',  // Shop Drawing / Method Statement / As-Built
  MATERIAL = 'MATERIAL',        // Material / Procurement Submittal
  CONTRACT = 'CONTRACT',        // Contract / Cost / BOQ
  TESTING = 'TESTING',          // Testing / Handover / QA
  ESG = 'ESG',                  // Environment / Social / Governance
}

// ─── Delegation Scope ──────────────────────────────────────────────────────
export enum DelegationScope {
  ALL = 'ALL',                              // มอบหมายทุกงาน
  RFA_ONLY = 'RFA_ONLY',                    // เฉพาะงาน RFA
  CORRESPONDENCE_ONLY = 'CORRESPONDENCE_ONLY', // เฉพาะงาน Correspondence
  SPECIFIC_TYPES = 'SPECIFIC_TYPES',        // กำหนดประเภทเอกสารเอง
}

// ─── Reminder Type ─────────────────────────────────────────────────────────
export enum ReminderType {
  DUE_SOON = 'DUE_SOON',              // X วันก่อนครบกำหนด
  ON_DUE = 'ON_DUE',                  // วันครบกำหนด
  OVERDUE = 'OVERDUE',                // หลังครบกำหนด (ส่งซ้ำทุกวัน)
  ESCALATION_L1 = 'ESCALATION_L1',    // Escalation ระดับ 1 (ถึง Manager)
  ESCALATION_L2 = 'ESCALATION_L2',    // Escalation ระดับ 2 (ถึง PM/Director)
}

// ─── Review Team Member Role ───────────────────────────────────────────────
export enum ReviewTeamMemberRole {
  REVIEWER = 'REVIEWER',  // ผู้ตรวจสอบ
  LEAD = 'LEAD',          // หัวหน้าทีม (Lead Reviewer)
  MANAGER = 'MANAGER',    // ผู้จัดการ (Escalation target)
}

// ─── Distribution Recipient Type ──────────────────────────────────────────
export enum RecipientType {
  USER = 'USER',                // ผู้ใช้เฉพาะคน
  ORGANIZATION = 'ORGANIZATION', // องค์กร
  TEAM = 'TEAM',                // ทีม
  ROLE = 'ROLE',                // บทบาท เช่น ALL_QS, ALL_SITE_ENG
}

// ─── Distribution Delivery Method ─────────────────────────────────────────
export enum DeliveryMethod {
  EMAIL = 'EMAIL',    // ส่งอีเมล
  IN_APP = 'IN_APP',  // แจ้งเตือนในระบบ
  BOTH = 'BOTH',      // ทั้งสองช่องทาง
}

// ─── Consensus Decision (Parallel Review) ─────────────────────────────────
export enum ConsensusDecision {
  APPROVED = 'APPROVED',            // ผ่าน (Majority approved)
  REJECTED = 'REJECTED',            // ไม่ผ่าน (Veto triggered by Code 3)
  APPROVED_WITH_COMMENTS = 'APPROVED_WITH_COMMENTS', // ผ่านพร้อมหมายเหตุ
  PENDING = 'PENDING',              // รอผล (ยังไม่ครบทุก Discipline)
  OVERRIDDEN = 'OVERRIDDEN',        // PM Override — บังคับผ่าน
}
