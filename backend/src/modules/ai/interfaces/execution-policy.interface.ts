// File: backend/src/modules/ai/interfaces/execution-policy.interface.ts
// Change Log:
// - 2026-06-11: Initial creation of execution policy interfaces for AI runtime policy refactor

/**
 * Public job types exposed in API.
 * ประเภทงานที่เปิดให้ภายนอกเรียกใช้งานผ่าน API
 */
export type PublicJobType =
  | 'auto-fill-document'
  | 'migrate-document'
  | 'rag-query';

/**
 * Internal job types used within the system.
 * ประเภทงานที่ใช้งานเป็นการภายในระบบ
 */
export type InternalJobType =
  | PublicJobType
  | 'intent-classify'
  | 'tool-suggest'
  | 'ocr-extract'
  | 'sandbox-analysis';

/**
 * Execution profiles for runtime resources.
 * โปรไฟล์การทำงานเพื่อระบุทรัพยากรและพารามิเตอร์ที่จะใช้งาน
 */
export type ExecutionProfile =
  | 'interactive'
  | 'standard'
  | 'quality'
  | 'deep-analysis';

/**
 * Interface representing the runtime configuration parameters.
 * อินเทอร์เฟสสำหรับกำหนดพารามิเตอร์ในขณะทำงาน
 */
export interface RuntimePolicy {
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  temperature: number;
  topP: number;
  maxTokens: number;
  numCtx: number;
  repeatPenalty: number;
  keepAliveSeconds: number;
}

/**
 * VRAM usage statistics.
 * สถิติการใช้ VRAM ของ GPU
 */
export interface VramHeadroom {
  totalMb: number;
  usedMb: number;
  availableMb: number;
  querySuccess: boolean;
  mainModelVramMb?: number;
}

/**
 * BullMQ job data payload.
 * ข้อมูลของงาน (Payload) สำหรับส่งเข้าคิว BullMQ
 */
export interface AiJobPayload {
  jobType: InternalJobType;
  documentPublicId?: string;
  attachmentPublicId?: string;
  effectiveProfile: ExecutionProfile;
  canonicalModel: 'np-dms-ai' | 'np-dms-ocr';
  snapshotParams: {
    temperature: number;
    topP: number;
    maxTokens: number;
    numCtx: number;
    repeatPenalty: number;
    keepAliveSeconds: number;
  };
}
