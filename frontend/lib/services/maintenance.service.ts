// File: lib/services/maintenance.service.ts
// Feature 253 T098-T102: Maintenance Console API client
// - 2026-09-07: Use crypto.randomUUID() for Idempotency-Key (Code Review L4)

import apiClient from '@/lib/api/client';

export interface OrphanFile {
  path: string;
  sizeBytes: number;
  lastModified: string;
  reason: string;
}

export interface NumberingGap {
  counterKey: string;
  expectedNext: number;
  actualNext: number;
  missingNumbers: number[];
}

export interface VectorSyncItem {
  projectPublicId: string;
  documentPublicId: string;
  action: string;
}

export interface ReleasedLock {
  lockKey: string;
  released: boolean;
  previousTtl?: number;
}

function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export const maintenanceService = {
  getNumberingGaps: async (projectId?: string): Promise<NumberingGap[]> => {
    const response = await apiClient.get('/maintenance/numbering/gaps', {
      params: projectId ? { projectId } : undefined,
    });
    return response.data.data;
  },

  syncCounters: async (projectId?: string): Promise<{ updated: number }> => {
    const response = await apiClient.post(
      '/maintenance/numbering/sync',
      { projectId },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
    return response.data.data;
  },

  overrideCounter: async (
    counterKey: string,
    newLastNumber: number
  ): Promise<{ counterKey: string; previousValue: number; newValue: number }> => {
    const response = await apiClient.post(
      '/maintenance/numbering/override',
      { counterKey, newLastNumber },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
    return response.data.data;
  },

  scanOrphans: async (): Promise<OrphanFile[]> => {
    const response = await apiClient.get('/maintenance/orphan-cleanup/scan');
    return response.data.data;
  },

  purgeOrphans: async (paths: string[]): Promise<{ deleted: number; failed: string[] }> => {
    const response = await apiClient.post(
      '/maintenance/orphan-cleanup/purge',
      { paths },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
    return response.data.data;
  },

  findMissingVectors: async (projectId?: string): Promise<VectorSyncItem[]> => {
    const response = await apiClient.get('/maintenance/vector-sync/missing', {
      params: projectId ? { projectId } : undefined,
    });
    return response.data.data;
  },

  enqueueReEmbed: async (projectPublicId: string, documentPublicId: string): Promise<void> => {
    await apiClient.post(
      '/maintenance/vector-sync/enqueue',
      { projectPublicId, documentPublicId },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
  },

  scanStuckLocks: async (): Promise<string[]> => {
    const response = await apiClient.get('/maintenance/emergency-unlock/stuck-locks');
    return response.data.data;
  },

  releaseLocks: async (lockKeys: string[]): Promise<ReleasedLock[]> => {
    const response = await apiClient.post(
      '/maintenance/emergency-unlock/release',
      { lockKeys },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
    return response.data.data;
  },

  bulkHardPurge: async (
    publicIds: string[],
    documentType: 'CORRESPONDENCE' | 'RFA' | 'TRANSMITTAL' | 'DRAWING'
  ): Promise<unknown[]> => {
    const response = await apiClient.post(
      '/maintenance/emergency-unlock/bulk-hard-purge',
      { publicIds, documentType },
      { headers: { 'Idempotency-Key': generateIdempotencyKey() } }
    );
    return response.data.data;
  },
};
