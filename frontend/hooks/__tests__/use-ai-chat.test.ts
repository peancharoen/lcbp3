// File: frontend/hooks/__tests__/use-ai-chat.test.ts
// Change Log:
// - 2026-05-19: สร้าง Unit Test สำหรับ useAiChat Hook
// - 2026-05-22: แก้ act() warning ใน test ล้างประวัติ — ใช้ async act() แทน sync

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { createTestQueryClient } from '@/lib/test-utils';
import { useAiChat } from '../use-ai-chat';
import axios from 'axios';

vi.mock('axios');

describe('useAiChat hook', () => {
  const mockContext = { type: 'rfa', publicId: '019505a1-7c3e-7000-8000-abc123def456' };
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
    }
  });
  it('ควรตั้งค่าสถานะเริ่มต้นให้ถูกต้อง', () => {
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
    expect(result.current.messages).toEqual([]);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });
  it('ควรสามารถส่งข้อความและรับคำตอบจาก AI สำเร็จ', async () => {
    const mockResponse = {
      data: {
        content: 'สวัสดีครับ ผมคือผู้ช่วย AI RFA',
        messageId: 'assistant-1',
        suggestedActions: [{ label: 'ปุ่มแนะนำ', query: 'คำสั่งแนะนำ' }],
      },
    };
    vi.mocked(axios.post).mockResolvedValue(mockResponse);
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
    await act(async () => {
      void result.current.sendMessage('สวัสดีครับ');
    });
    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[0].role).toBe('user');
    expect(result.current.messages[0].content).toBe('สวัสดีครับ');
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.messages.length).toBe(2);
    expect(result.current.messages[1].role).toBe('assistant');
    expect(result.current.messages[1].content).toBe('สวัสดีครับ ผมคือผู้ช่วย AI RFA');
    expect(result.current.messages[1].suggestedActions).toEqual([{ label: 'ปุ่มแนะนำ', query: 'คำสั่งแนะนำ' }]);
  });
  it('ควรทำงานถูกต้องเมื่อเกิดข้อผิดพลาดในการเรียก API', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Network error'));
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
    await act(async () => {
      void result.current.sendMessage('สวัสดี');
    });
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.messages[1].content).toContain('ไม่สามารถเชื่อมต่อ AI ได้');
  });
  it('ควรสามารถล้างประวัติการสนทนาได้', async () => {
    const { wrapper } = createTestQueryClient();
    const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
    // ใช้ async act() เพื่อให้ React flush state updates จาก sendMessage (Promise) ได้ครบ
    await act(async () => {
      void result.current.sendMessage('สวัสดี');
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.messages).toEqual([]);
  });

  // ── D267: Two-Phase Batch OCR/AI Extraction — AI_FEATURES_UNAVAILABLE (503) ─────
  describe('AI_FEATURES_UNAVAILABLE (D267)', () => {
    function makeUnavailableError() {
      return {
        isAxiosError: true,
        response: {
          status: 503,
          data: { error: { code: 'AI_FEATURES_UNAVAILABLE' } },
        },
      };
    }

    beforeEach(() => {
      vi.mocked(axios.isAxiosError).mockImplementation(
        (err: unknown): err is import('axios').AxiosError =>
          !!(err as { isAxiosError?: boolean })?.isAxiosError
      );
    });

    it('เปิด dialog แทน append error bubble ทันที เมื่อเจอ 503 AI_FEATURES_UNAVAILABLE', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(makeUnavailableError());
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
      await act(async () => {
        void result.current.sendMessage('สวัสดี');
      });
      await waitFor(() => {
        expect(result.current.isAiUnavailableDialogOpen).toBe(true);
      });
      // ข้อความ assistant ยังเป็น placeholder ที่กำลัง stream อยู่ ไม่ใช่ error bubble คงที่
      expect(result.current.messages[1].isStreaming).toBe(true);
      expect(result.current.messages[1].content).not.toContain(
        'ไม่สามารถเชื่อมต่อ AI ได้'
      );
    });

    it('กด "รอ" แล้ว retry สำเร็จ → ปิด dialog และแสดงคำตอบจริง', async () => {
      vi.useFakeTimers();
      vi.mocked(axios.post)
        .mockRejectedValueOnce(makeUnavailableError())
        .mockResolvedValueOnce({
          data: { content: 'คำตอบหลัง batch OCR เสร็จ', messageId: 'assistant-retry' },
        });
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
      await act(async () => {
        void result.current.sendMessage('สวัสดี');
      });
      expect(result.current.isAiUnavailableDialogOpen).toBe(true);

      act(() => {
        result.current.waitAiUnavailableRetry();
      });
      expect(result.current.isAiUnavailableRetrying).toBe(true);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(8000);
      });

      expect(result.current.isAiUnavailableDialogOpen).toBe(false);
      expect(result.current.messages[1].content).toBe('คำตอบหลัง batch OCR เสร็จ');
      vi.useRealTimers();
    });

    it('กด "ยกเลิก" → ปิด dialog และ mark ข้อความ pending เป็นยกเลิกแทน error bubble', async () => {
      vi.mocked(axios.post).mockRejectedValueOnce(makeUnavailableError());
      const { wrapper } = createTestQueryClient();
      const { result } = renderHook(() => useAiChat(mockContext), { wrapper });
      await act(async () => {
        void result.current.sendMessage('สวัสดี');
      });
      expect(result.current.isAiUnavailableDialogOpen).toBe(true);

      act(() => {
        result.current.cancelAiUnavailableWait();
      });

      expect(result.current.isAiUnavailableDialogOpen).toBe(false);
      expect(result.current.messages[1].isStreaming).toBe(false);
      expect(result.current.messages[1].content).toBe('ผู้ใช้ยกเลิกการส่งข้อความ');
    });
  });
});
