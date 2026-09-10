// File: backend/test/fixtures/rag-admin-fixtures.ts
// Change Log:
// - 2026-09-10: T063-T067 — Shared E2E fixture factory functions (Feature 255, Q51)

import { v7 as uuidv7 } from 'uuid';

/**
 * Factory functions สำหรับสร้าง mock objects ใน E2E tests (Q51)
 * ใช้ร่วมกับ rag-admin-*.e2e-spec.ts files
 */

/** Override props สำหรับ Attachment */
export interface MockAttachmentProps {
  publicId?: string;
  originalFilename?: string;
  mimeType?: string;
  checksum?: string | null;
  aiProcessingStatus?: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  effectiveClassification?: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
  projectPublicId?: string;
  createdAt?: Date;
}

/** สร้าง mock Attachment พร้อม override */
export function createMockAttachment(props: MockAttachmentProps = {}) {
  return {
    publicId: props.publicId ?? uuidv7(),
    originalFilename: props.originalFilename ?? 'test-document.pdf',
    mimeType: props.mimeType ?? 'application/pdf',
    checksum: props.checksum ?? 'abc123def456',
    aiProcessingStatus: props.aiProcessingStatus ?? 'DONE',
    effectiveClassification: props.effectiveClassification ?? 'PUBLIC',
    projectPublicId: props.projectPublicId ?? uuidv7(),
    createdAt: props.createdAt ?? new Date(),
  };
}

/** Override props สำหรับ RagAttachmentGeneration */
export interface MockGenerationProps {
  generationUuid?: string;
  attachmentUuid?: string;
  status?: 'BUILDING' | 'ACTIVE' | 'RETIRED' | 'FAILED';
  attachmentChecksumSnapshot?: string;
  createdAt?: Date;
  activatedAt?: Date | null;
  retiredAt?: Date | null;
  failedAt?: Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}

/** สร้าง mock RagAttachmentGeneration พร้อม override */
export function createMockGeneration(props: MockGenerationProps = {}) {
  return {
    generationUuid: props.generationUuid ?? uuidv7(),
    attachmentUuid: props.attachmentUuid ?? uuidv7(),
    status: props.status ?? 'ACTIVE',
    attachmentChecksumSnapshot:
      props.attachmentChecksumSnapshot ?? 'abc123def456',
    createdAt: props.createdAt ?? new Date(),
    activatedAt: props.activatedAt ?? null,
    retiredAt: props.retiredAt ?? null,
    failedAt: props.failedAt ?? null,
    errorCode: props.errorCode ?? null,
    errorMessage: props.errorMessage ?? null,
  };
}

/** Override props สำหรับ RagAttachmentChunk */
export interface MockChunkProps {
  chunkPublicId?: string;
  generationUuid?: string;
  chunkIndex?: number;
  content?: string;
  segmentType?: string;
  classification?: string;
}

/** สร้าง mock RagAttachmentChunk พร้อม override */
export function createMockChunk(props: MockChunkProps = {}) {
  return {
    chunkPublicId: props.chunkPublicId ?? uuidv7(),
    generationUuid: props.generationUuid ?? uuidv7(),
    chunkIndex: props.chunkIndex ?? 0,
    content: props.content ?? 'Sample chunk content',
    segmentType: props.segmentType ?? 'text',
    classification: props.classification ?? 'PUBLIC',
  };
}

/** Override props สำหรับ failed ingestion */
export interface MockFailedIngestionProps {
  attachmentPublicId?: string;
  originalFilename?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  failedAt?: Date | null;
}

/** สร้าง mock failed ingestion item พร้อม override */
export function createMockFailedIngestion(
  props: MockFailedIngestionProps = {}
) {
  return {
    attachmentPublicId: props.attachmentPublicId ?? uuidv7(),
    originalFilename: props.originalFilename ?? 'failed-document.pdf',
    ragStatus: 'FAILED' as const,
    errorCode: props.errorCode ?? 'OCR_ERROR',
    errorMessage: props.errorMessage ?? 'OCR processing failed',
    failedAt: props.failedAt ?? new Date(),
  };
}

/** Override props สำหรับ AI pipeline failure */
export interface MockAiPipelineFailureProps {
  attachmentPublicId?: string;
  originalFilename?: string;
  errorMessage?: string | null;
}

/** สร้าง mock AI pipeline failure item พร้อม override */
export function createMockAiPipelineFailure(
  props: MockAiPipelineFailureProps = {}
) {
  return {
    attachmentPublicId: props.attachmentPublicId ?? uuidv7(),
    originalFilename: props.originalFilename ?? 'pipeline-failed.pdf',
    aiProcessingStatus: 'FAILED' as const,
    errorMessage: props.errorMessage ?? null,
  };
}

/** Override props สำหรับ classification override */
export interface MockClassificationOverrideProps {
  reason?: string;
  overriddenBy?: string;
  overriddenAt?: Date;
}

/** สร้าง mock classificationOverride object พร้อม override */
export function createMockClassificationOverride(
  props: MockClassificationOverrideProps = {}
) {
  return {
    reason: props.reason ?? 'Security review required',
    overriddenBy: props.overriddenBy ?? 'admin@example.com',
    overriddenAt: props.overriddenAt ?? new Date(),
  };
}

/** สร้าง batch ของ mock attachments */
export function createMockAttachments(
  count: number,
  baseProps: MockAttachmentProps = {}
) {
  return Array.from({ length: count }, () => createMockAttachment(baseProps));
}

/** สร้าง batch ของ mock generations สำหรับ attachment เดียว */
export function createMockGenerationsForAttachment(
  attachmentPublicId: string,
  count: number,
  baseProps: MockGenerationProps = {}
) {
  return Array.from({ length: count }, (_, i) =>
    createMockGeneration({
      ...baseProps,
      attachmentUuid: attachmentPublicId,
      chunkIndex: i,
    })
  );
}
