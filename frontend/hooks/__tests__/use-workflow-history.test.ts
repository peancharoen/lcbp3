// File: frontend/hooks/__tests__/use-workflow-history.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useWorkflowHistory hook
// - 2026-06-13: Refactor to use static imports and createTestQueryClient helper

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useWorkflowHistory, workflowHistoryKeys } from '../use-workflow-history';
import { createTestQueryClient } from '@/lib/test-utils';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';

// Mock workflowEngineService
vi.mock('@/lib/services/workflow-engine.service', () => ({
  workflowEngineService: {
    getHistory: vi.fn(),
  },
}));

describe('useWorkflowHistory', () => {
  const mockInstanceId = '019505a1-7c3e-7000-8000-abc123def456';
  const mockHistory = [
    {
      id: 1,
      fromState: 'DFT',
      toState: 'FAP',
      action: 'SUBMIT',
      actorId: 'user-uuid',
      actorName: 'Test User',
      timestamp: '2026-01-01T00:00:00Z',
      comments: 'Submitted for approval',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return workflow history data', async () => {
    (workflowEngineService.getHistory as any).mockResolvedValue(mockHistory);

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(mockInstanceId), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockHistory);
    expect(workflowEngineService.getHistory).toHaveBeenCalledWith(mockInstanceId);
  });

  it('should be disabled when instanceId is undefined', () => {
    (workflowEngineService.getHistory as any).mockResolvedValue(mockHistory);

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(undefined), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(workflowEngineService.getHistory).not.toHaveBeenCalled();
  });

  it('should be disabled when instanceId is empty string', () => {
    (workflowEngineService.getHistory as any).mockResolvedValue(mockHistory);

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(workflowEngineService.getHistory).not.toHaveBeenCalled();
  });

  it('should handle fetch error', async () => {
    (workflowEngineService.getHistory as any).mockRejectedValue(new Error('API Error'));

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(mockInstanceId), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('should not retry on failure (retry: false)', async () => {
    (workflowEngineService.getHistory as any).mockRejectedValue(new Error('API Error'));

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(mockInstanceId), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should only be called once (no retry)
    expect(workflowEngineService.getHistory).toHaveBeenCalledTimes(1);
  });

  it('should use correct query key', async () => {
    (workflowEngineService.getHistory as any).mockResolvedValue(mockHistory);

    const { wrapper } = createTestQueryClient();
    renderHook(() => useWorkflowHistory(mockInstanceId), { wrapper });

    await waitFor(() => {
      expect(workflowEngineService.getHistory).toHaveBeenCalled();
    });

    // Verify query key structure
    const expectedKey = workflowHistoryKeys.instance(mockInstanceId);
    expect(expectedKey).toEqual(['workflow-history', mockInstanceId]);
  });

  it('should return empty array when no history exists', async () => {
    (workflowEngineService.getHistory as any).mockResolvedValue([]);

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowHistory(mockInstanceId), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });

  it('should handle multiple instance IDs correctly', async () => {
    (workflowEngineService.getHistory as any).mockResolvedValue(mockHistory);

    const { wrapper } = createTestQueryClient();
    const { result: result1 } = renderHook(() => useWorkflowHistory('instance-1'), { wrapper });
    const { result: result2 } = renderHook(() => useWorkflowHistory('instance-2'), { wrapper });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    expect(workflowEngineService.getHistory).toHaveBeenCalledWith('instance-1');
    expect(workflowEngineService.getHistory).toHaveBeenCalledWith('instance-2');
  });
});
