// File: frontend/lib/services/__tests__/maintenance.service.test.ts
// Change Log:
// - 2026-09-09: Initial creation — regression test for the TransformInterceptor
//   double-wrap bug. Every maintenance.controller.ts route returns a bare value
//   (array or plain object), which the global TransformInterceptor wraps into
//   { statusCode, message, data }. maintenanceService previously returned
//   response.data (one level too shallow — the envelope itself, not its payload),
//   so e.g. findMissingVectors() resolved to { statusCode, message, data: [...] }
//   instead of the array its own TS type promised. Callers (the maintenance admin
//   tabs) never defensively unwrapped, so `.length`/`.map()` on that envelope
//   crashed into the Admin Panel error boundary (app/(admin)/error.tsx).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { maintenanceService } from '../maintenance.service';
import apiClient from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

/** จำลอง response ที่ TransformInterceptor ห่อจริง (axios .data = envelope ทั้งก้อน) */
function envelope<T>(data: T) {
  return { data: { statusCode: 200, message: 'Success', data } };
}

describe('maintenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getNumberingGaps unwraps the TransformInterceptor envelope', async () => {
    const gaps = [{ counterKey: 'CIR-2026', expectedNext: 5, actualNext: 7, missingNumbers: [5, 6] }];
    vi.mocked(apiClient.get).mockResolvedValue(envelope(gaps));

    const result = await maintenanceService.getNumberingGaps();

    expect(result).toEqual(gaps);
  });

  it('scanOrphans unwraps the envelope', async () => {
    const files = [{ path: '/tmp/x.pdf', sizeBytes: 10, lastModified: '2026-01-01', reason: 'orphan' }];
    vi.mocked(apiClient.get).mockResolvedValue(envelope(files));

    const result = await maintenanceService.scanOrphans();

    expect(result).toEqual(files);
  });

  it('findMissingVectors unwraps the envelope (regression: Admin Panel Error crash)', async () => {
    const items = [{ projectPublicId: 'p1', documentPublicId: 'd1', action: 'RE_EMBED' }];
    vi.mocked(apiClient.get).mockResolvedValue(envelope(items));

    const result = await maintenanceService.findMissingVectors();

    // Before the fix this resolved to { statusCode, message, data: items } —
    // an object with no .length, which crashed `items.map()` in vector-sync-tab.tsx.
    expect(result).toEqual(items);
    expect(Array.isArray(result)).toBe(true);
  });

  it('scanStuckLocks unwraps the envelope (regression: Admin Panel Error crash)', async () => {
    const locks = ['lock:doc:abc', 'lock:doc:def'];
    vi.mocked(apiClient.get).mockResolvedValue(envelope(locks));

    const result = await maintenanceService.scanStuckLocks();

    expect(result).toEqual(locks);
    expect(Array.isArray(result)).toBe(true);
  });

  it('releaseLocks unwraps the envelope', async () => {
    const released = [{ lockKey: 'lock:doc:abc', released: true }];
    vi.mocked(apiClient.post).mockResolvedValue(envelope(released));

    const result = await maintenanceService.releaseLocks(['lock:doc:abc']);

    expect(result).toEqual(released);
  });

  it('purgeOrphans unwraps a plain-object (non-array) envelope', async () => {
    const purgeResult = { deleted: 2, failed: [] };
    vi.mocked(apiClient.post).mockResolvedValue(envelope(purgeResult));

    const result = await maintenanceService.purgeOrphans(['/tmp/a', '/tmp/b']);

    expect(result).toEqual(purgeResult);
  });

  it('bulkHardPurge unwraps the envelope', async () => {
    const purged = [{ publicId: 'doc-1', status: 'PURGED' }];
    vi.mocked(apiClient.post).mockResolvedValue(envelope(purged));

    const result = await maintenanceService.bulkHardPurge(['doc-1'], 'CORRESPONDENCE');

    expect(result).toEqual(purged);
  });
});
