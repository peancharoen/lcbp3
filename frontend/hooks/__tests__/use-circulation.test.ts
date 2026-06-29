import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import {
  useCirculationsByCorrespondence,
  circulationKeys,
} from '../use-circulation';
import { circulationService } from '@/lib/services/circulation.service';

vi.mock('@/lib/services/circulation.service', () => ({
  circulationService: {
    getByCorrespondenceUuid: vi.fn(),
  },
}));

describe('use-circulation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('circulationKeys', () => {
    it('should generate correct cache keys', () => {
      expect(circulationKeys.all).toEqual(['circulations']);
      expect(circulationKeys.byCorrespondence('uuid-abc')).toEqual([
        'circulations',
        'byCorrespondence',
        'uuid-abc',
      ]);
    });
  });

  describe('useCirculationsByCorrespondence', () => {
    it('should fetch circulations for a correspondence publicId', async () => {
      const mockData = {
        data: [
          {
            uuid: 'circ-uuid-1',
            circulationNo: 'CIR-001',
            subject: 'Review Document',
            statusCode: 'OPEN',
            routings: [],
          },
        ],
        meta: { total: 1, page: 1, limit: 50 },
      };

      vi.mocked(circulationService.getByCorrespondenceUuid).mockResolvedValue(mockData);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useCirculationsByCorrespondence('corr-uuid-1'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(circulationService.getByCorrespondenceUuid).toHaveBeenCalledWith('corr-uuid-1');
      expect(result.current.data).toEqual(mockData);
    });

    it('should not fetch when correspondencePublicId is empty', () => {
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useCirculationsByCorrespondence(''),
        { wrapper }
      );

      expect(result.current.fetchStatus).toBe('idle');
      expect(circulationService.getByCorrespondenceUuid).not.toHaveBeenCalled();
    });

    it('should handle fetch error gracefully', async () => {
      vi.mocked(circulationService.getByCorrespondenceUuid).mockRejectedValue(
        new Error('Network error')
      );

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useCirculationsByCorrespondence('corr-uuid-error'),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
    });

    it('should use the correct query key', () => {
      vi.mocked(circulationService.getByCorrespondenceUuid).mockResolvedValue([]);

      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(
        () => useCirculationsByCorrespondence('test-uuid'),
        { wrapper }
      );

      expect(result.current.status).toBeDefined();
      expect(circulationKeys.byCorrespondence('test-uuid')).toEqual([
        'circulations',
        'byCorrespondence',
        'test-uuid',
      ]);
    });
  });
});
