// File: frontend/hooks/__tests__/use-ai-prompts.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useAiPrompts and useSandboxRun hooks

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useAiPrompts, useSandboxRun } from '../use-ai-prompts';
import { aiPromptsService } from '@/lib/services/ai-prompts.service';
import { adminAiService } from '@/lib/services/admin-ai.service';

// Mock services
vi.mock('@/lib/services/ai-prompts.service', () => ({
  aiPromptsService: {
    listVersions: vi.fn(),
    createVersion: vi.fn(),
    activateVersion: vi.fn(),
    deleteVersion: vi.fn(),
    updateNote: vi.fn(),
  },
}));

vi.mock('@/lib/services/admin-ai.service', () => ({
  adminAiService: {
    getSandboxJobStatus: vi.fn(),
    submitSandboxExtract: vi.fn(),
  },
}));

describe('useAiPrompts hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAiPrompts', () => {
    it('ควรดึงข้อมูล prompt versions สำเร็จ', async () => {
      const mockData = [{ versionNumber: 1, template: 'test', isActive: true }];
      vi.mocked(aiPromptsService.listVersions).mockResolvedValue(mockData as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiPrompts('RFA'), { wrapper });
      await waitFor(() => {
        expect(result.current.versionsQuery.isSuccess).toBe(true);
      });
      expect(result.current.versionsQuery.data).toEqual(mockData);
      expect(aiPromptsService.listVersions).toHaveBeenCalledWith('RFA');
    });

    it('ควรเรียก createVersion สำเร็จ', async () => {
      vi.mocked(aiPromptsService.createVersion).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiPrompts('RFA'), { wrapper });
      await act(async () => {
        await result.current.createMutation.mutateAsync('new template');
      });
      expect(aiPromptsService.createVersion).toHaveBeenCalledWith('RFA', 'new template');
    });

    it('ควรเรียก activateVersion สำเร็จ', async () => {
      vi.mocked(aiPromptsService.activateVersion).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiPrompts('RFA'), { wrapper });
      await act(async () => {
        await result.current.activateMutation.mutateAsync(2);
      });
      expect(aiPromptsService.activateVersion).toHaveBeenCalledWith('RFA', 2);
    });

    it('ควรเรียก deleteVersion สำเร็จ', async () => {
      vi.mocked(aiPromptsService.deleteVersion).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiPrompts('RFA'), { wrapper });
      await act(async () => {
        await result.current.deleteMutation.mutateAsync(3);
      });
      expect(aiPromptsService.deleteVersion).toHaveBeenCalledWith('RFA', 3);
    });

    it('ควรเรียก updateNote สำเร็จ', async () => {
      vi.mocked(aiPromptsService.updateNote).mockResolvedValue({ success: true } as any);
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiPrompts('RFA'), { wrapper });
      await act(async () => {
        await result.current.updateNoteMutation.mutateAsync({ versionNumber: 1, note: 'New Note' });
      });
      expect(aiPromptsService.updateNote).toHaveBeenCalledWith('RFA', 1, 'New Note');
    });
  });
});

describe('useSandboxRun hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ควรเริ่มต้นด้วยสถานะว่างเปล่า', () => {
    const { result } = renderHook(() => useSandboxRun());
    expect(result.current.state).toEqual({
      isRunning: false,
      progress: 0,
      statusText: '',
      result: null,
    });
    expect(result.current.jobId).toBeNull();
  });

  it('ควรสามารถส่ง job และจำลอง polling จนกระทั่งเสร็จสิ้น (completed)', async () => {
    const mockFile = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' });
    vi.mocked(adminAiService.submitSandboxExtract).mockResolvedValue({ requestPublicId: 'job-123' } as any);
    let pollCount = 0;
    vi.mocked(adminAiService.getSandboxJobStatus).mockImplementation(async () => {
      pollCount += 1;
      if (pollCount === 1) return { status: 'pending' } as any;
      if (pollCount === 2) return { status: 'processing' } as any;
      return { status: 'completed', metadata: { test: 1 } } as any;
    });
    const onCompletedMock = vi.fn();
    const { result } = renderHook(() => useSandboxRun(onCompletedMock));
    let jobIdPromise: Promise<string> | undefined;
    act(() => {
      jobIdPromise = result.current.submit(mockFile, 'project-1', 'contract-1');
    });
    await act(async () => {
      await jobIdPromise;
    });
    expect(result.current.jobId).toBe('job-123');
    expect(result.current.state.isRunning).toBe(true);
    expect(result.current.state.progress).toBe(30);
    expect(result.current.state.statusText).toBe('ai.prompt.statusPending');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.state.progress).toBe(70);
    expect(result.current.state.statusText).toBe('ai.prompt.statusProcessing');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.statusText).toBe('ai.prompt.statusCompleted');
    expect(onCompletedMock).toHaveBeenCalled();
  });

  it('ควรหยุดการ polling เมื่อสถานะเป็น failed', async () => {
    const mockFile = new File(['pdf-content'], 'test.pdf', { type: 'application/pdf' });
    vi.mocked(adminAiService.submitSandboxExtract).mockResolvedValue({ requestPublicId: 'job-failed' } as any);
    vi.mocked(adminAiService.getSandboxJobStatus).mockResolvedValue({ status: 'failed' } as any);
    const { result } = renderHook(() => useSandboxRun());
    let jobIdPromise: Promise<string> | undefined;
    act(() => {
      jobIdPromise = result.current.submit(mockFile, 'project-1');
    });
    await act(async () => {
      await jobIdPromise;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.statusText).toBe('ai.prompt.statusFailed');
    expect(result.current.jobId).toBeNull();
  });

  it('ควรหยุดการ polling เมื่อสถานะเป็น cancelled', async () => {
    vi.mocked(adminAiService.getSandboxJobStatus).mockResolvedValue({ status: 'cancelled' } as any);
    const { result } = renderHook(() => useSandboxRun());
    act(() => {
      result.current.startPolling('job-cancelled');
    });
    expect(result.current.jobId).toBe('job-cancelled');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.state.isRunning).toBe(false);
    expect(result.current.state.progress).toBe(100);
    expect(result.current.state.statusText).toBe('ai.prompt.statusCancelled');
    expect(result.current.jobId).toBeNull();
  });

  it('ควรจะทำงานต่อเงียบๆ และพยายามต่อเมื่อเกิด network error ระหว่าง polling', async () => {
    vi.mocked(adminAiService.getSandboxJobStatus).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useSandboxRun());
    act(() => {
      result.current.startPolling('job-error');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.jobId).toBe('job-error');
  });

  it('ควรสามารถรีเซ็ตสถานะกลับสู่ค่าเริ่มต้นได้', () => {
    const { result } = renderHook(() => useSandboxRun());
    act(() => {
      result.current.startPolling('job-to-reset');
    });
    expect(result.current.jobId).toBe('job-to-reset');
    act(() => {
      result.current.reset();
    });
    expect(result.current.jobId).toBeNull();
    expect(result.current.state.isRunning).toBe(false);
  });
});
