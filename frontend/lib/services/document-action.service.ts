// File: lib/services/document-action.service.ts
// Feature 253 T029: Generic API caller for document actions

import apiClient from '@/lib/api/client';
import { DocumentActionResult } from '@/components/documents/document-action-strategy';

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

/**
 * Service สำหรับเรียก document action APIs
 * ใช้ร่วมกันทุก document type — รับ apiBasePath จาก strategy config
 */
export const documentActionService = {
  /**
   * ยกเลิกเอกสาร (POST /{apiBasePath}/{publicId}/cancel)
   */
  cancel: async (
    apiBasePath: string,
    publicId: string,
    reason?: string,
  ): Promise<DocumentActionResult> => {
    const response = await apiClient.post(
      `${apiBasePath}/${publicId}/cancel`,
      { reason },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * ลบถาวร (DELETE /{apiBasePath}/{publicId}/hard)
   */
  hardDelete: async (
    apiBasePath: string,
    publicId: string,
  ): Promise<DocumentActionResult> => {
    const response = await apiClient.delete(
      `${apiBasePath}/${publicId}/hard`,
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * แก้ไข metadata (PATCH /{apiBasePath}/{publicId}/metadata)
   */
  metadataPatch: async (
    apiBasePath: string,
    publicId: string,
    patch: Record<string, string | number | boolean | null>,
    version: number,
  ): Promise<DocumentActionResult> => {
    const response = await apiClient.patch(
      `${apiBasePath}/${publicId}/metadata`,
      { patch, version },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * Bulk cancel (POST /documents/bulk/cancel)
   */
  bulkCancel: async (
    publicIds: string[],
    documentType: string,
    reason?: string,
  ): Promise<{ bulkId: string }> => {
    const response = await apiClient.post(
      '/documents/bulk/cancel',
      { publicIds, documentType, reason },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * Bulk tag (POST /documents/bulk/tag)
   * addTags/removeTags เป็น tag IDs (integer FKs)
   */
  bulkTag: async (
    publicIds: string[],
    documentType: string,
    addTags: number[],
    removeTags?: number[],
  ): Promise<{ bulkId: string }> => {
    const response = await apiClient.post(
      '/documents/bulk/tag',
      { publicIds, documentType, addTags, removeTags },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * Bulk export (POST /documents/bulk/export)
   */
  bulkExport: async (
    publicIds: string[],
    documentType: string,
    format: 'CSV' | 'XLSX' | 'JSON',
    columns?: string[],
  ): Promise<{ bulkId: string; downloadUrl?: string }> => {
    const response = await apiClient.post(
      '/documents/bulk/export',
      { publicIds, documentType, format, columns },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } },
    );
    return response.data;
  },

  /**
   * Poll bulk operation progress (GET /documents/bulk/{bulkId}/progress)
   */
  getBulkProgress: async (
    bulkId: string,
  ): Promise<{ total: number; completed: number; failed: number; done: boolean; downloadUrl?: string; failedItems?: string[] }> => {
    const response = await apiClient.get(`/documents/bulk/${bulkId}/progress`);
    return response.data;
  },
};
