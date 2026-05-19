// File: frontend/hooks/__tests__/use-ai-chat.test.ts
// Change Log:
// - 2026-05-19: สร้าง Unit Test สำหรับ useAiChat Hook

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
    act(() => {
      result.current.sendMessage('สวัสดี');
    });
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.messages).toEqual([]);
  });
});
