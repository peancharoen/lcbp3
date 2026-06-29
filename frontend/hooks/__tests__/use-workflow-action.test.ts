// ADR-021 T027a: ทดสอบ HTTP 503 / 409 / 403 error handling ใน useWorkflowAction
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useWorkflowAction } from '../use-workflow-action';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';
import { toast } from 'sonner';

// Mock service
vi.mock('@/lib/services/workflow-engine.service', () => ({
  workflowEngineService: {
    transition: vi.fn(),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Helper — สร้าง ApiErrorResponse ปลอมตามรูปแบบ parseApiError
function makeApiError(statusCode: number, message: string, recoveryActions?: string[]) {
  return {
    error: {
      type: 'BUSINESS',
      code: 'HTTP_ERROR',
      message,
      severity: statusCode >= 500 ? 'HIGH' : 'MEDIUM',
      timestamp: new Date().toISOString(),
      statusCode,
      recoveryActions,
    },
  };
}

describe('useWorkflowAction — T027a error handling (Clarify Q1+Q2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Q2 (503): should show "ระบบยุ่ง" toast when Redlock Fail-closed', async () => {
    vi.mocked(workflowEngineService.transition).mockRejectedValue(
      makeApiError(503, 'ระบบยุ่งชั่วคราว กรุณาลองใหม่ภายหลัง')
    );

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'ระบบยุ่งชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง',
      expect.objectContaining({
        description: expect.stringContaining('ข้อมูลของคุณปลอดภัย'),
      })
    );
  });

  it('Q1 (409): should show state violation toast with backend message', async () => {
    vi.mocked(workflowEngineService.transition).mockRejectedValue(
      makeApiError(409, 'ไม่สามารถอัปโหลดไฟล์ในสถานะนี้ได้', [
        'อนุญาตเฉพาะสถานะ PENDING_REVIEW หรือ PENDING_APPROVAL',
      ])
    );

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE', attachmentPublicIds: ['a1'] });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'ไม่สามารถอัปโหลดไฟล์ในสถานะนี้ได้',
      expect.objectContaining({
        description: 'อนุญาตเฉพาะสถานะ PENDING_REVIEW หรือ PENDING_APPROVAL',
      })
    );
  });

  it('M1 (403): should use backend-provided message instead of hardcoded string', async () => {
    // backend ส่ง message แบบ contextual (cross-contract) — frontend ต้อง preserve
    vi.mocked(workflowEngineService.transition).mockRejectedValue(
      makeApiError(
        403,
        'คุณไม่มีสิทธิ์เข้าถึง Workflow ของสัญญานี้',
        ['ตรวจสอบสิทธิ์กับ Project Admin']
      )
    );

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // ✓ toast ต้องใช้ backend message (ไม่ใช่ "คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้" generic)
    expect(toast.error).toHaveBeenCalledWith(
      'คุณไม่มีสิทธิ์เข้าถึง Workflow ของสัญญานี้',
      expect.objectContaining({
        description: 'ตรวจสอบสิทธิ์กับ Project Admin',
      })
    );
  });

  it('M1 (403): should fallback to generic message when backend message missing', async () => {
    vi.mocked(workflowEngineService.transition).mockRejectedValue(
      makeApiError(403, '', ['ติดต่อ Admin'])
    );

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith(
      'คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้',
      expect.objectContaining({
        description: 'ติดต่อ Admin',
      })
    );
  });

  it('M3 (409): should reset idempotency key after 409 so retry uses fresh key', async () => {
    // First call → 409
    vi.mocked(workflowEngineService.transition).mockRejectedValueOnce(
      makeApiError(409, 'ไม่สามารถอัปโหลดในสถานะนี้ได้', ['รีเฟรชหน้า'])
    );
    // Second call → success
    vi.mocked(workflowEngineService.transition).mockResolvedValueOnce({
      success: true,
      nextState: 'APPROVED',
    });

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    // First mutate → 409
    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const firstKey = vi
      .mocked(workflowEngineService.transition)
      .mock.calls[0][2];

    // Second mutate → success
    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const secondKey = vi
      .mocked(workflowEngineService.transition)
      .mock.calls[1][2];

    // ✓ Key ต้องแตกต่างกัน (reset แล้วหลัง 409)
    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(secondKey).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('M3 (503): should NOT reset idempotency key (user can retry with same key)', async () => {
    // First call → 503
    vi.mocked(workflowEngineService.transition).mockRejectedValueOnce(
      makeApiError(503, 'ระบบยุ่ง')
    );
    // Second call → success
    vi.mocked(workflowEngineService.transition).mockResolvedValueOnce({
      success: true,
    });

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));

    const firstKey = vi
      .mocked(workflowEngineService.transition)
      .mock.calls[0][2];

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const secondKey = vi
      .mocked(workflowEngineService.transition)
      .mock.calls[1][2];

    // ✓ Key ต้องเหมือนเดิม (503 = retryable, same intent)
    expect(firstKey).toBe(secondKey);
  });

  it('should show success toast on 200', async () => {
    vi.mocked(workflowEngineService.transition).mockResolvedValue({
      success: true,
      nextState: 'APPROVED',
    });

    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction('inst-1'), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(toast.success).toHaveBeenCalledWith('ดำเนินการเรียบร้อยแล้ว');
  });

  it('should reject when instanceId is undefined', async () => {
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useWorkflowAction(undefined), { wrapper });

    await act(async () => {
      result.current.mutate({ action: 'APPROVE' });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('ไม่พบ Workflow Instance ID')
    );
  });
});
