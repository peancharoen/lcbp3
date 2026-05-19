// File: frontend/components/ai/__tests__/ai-chat-panel.test.tsx
// Change Log:
// - 2026-05-19: สร้าง Unit Test สำหรับคอมโพเนนต์ AiChatPanel

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AiChatPanel } from '../ai-chat-panel';
import { useAiChat } from '@/hooks/use-ai-chat';

vi.mock('@/hooks/use-ai-chat');

describe('AiChatPanel Component', () => {
  const mockContext = { type: 'rfa', publicId: '019505a1-7c3e-7000-8000-abc123def456' };
  const mockOnClose = vi.fn();
  const mockOnToggle = vi.fn();
  const mockSendMessage = vi.fn();
  const mockClearHistory = vi.fn();
  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.clearAllMocks();
    vi.mocked(useAiChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      isLoading: false,
      isOpen: false,
      setIsOpen: vi.fn(),
      toggleOpen: vi.fn(),
    });
  });
  it('ควรเรนเดอร์คอมโพเนนต์อย่างถูกต้อง', () => {
    render(
      <AiChatPanel
        context={mockContext}
        isOpen={true}
        onClose={mockOnClose}
        onToggle={mockOnToggle}
      />
    );
    expect(screen.getByText('ผู้ช่วยอัจฉริยะ AI')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/ถาม AI เกี่ยวกับเอกสารนี้/i)).toBeInTheDocument();
  });
  it('ควรซ่อนปุ่มล้างประวัติการสนทนาเมื่อไม่มีข้อความ', () => {
    render(
      <AiChatPanel
        context={mockContext}
        isOpen={true}
        onClose={mockOnClose}
        onToggle={mockOnToggle}
      />
    );
    expect(screen.queryByTitle('ล้างประวัติการสนทนา')).not.toBeInTheDocument();
  });
  it('ควรแสดงปุ่มล้างประวัติการสนทนาเมื่อมีข้อความในประวัติและคลิกเพื่อล้างข้อมูลได้', () => {
    vi.mocked(useAiChat).mockReturnValue({
      messages: [
        { id: '1', role: 'user', content: 'สวัสดี', timestamp: '2026-05-19T00:00:00.000Z' }
      ],
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      isLoading: false,
      isOpen: false,
      setIsOpen: vi.fn(),
      toggleOpen: vi.fn(),
    });
    render(
      <AiChatPanel
        context={mockContext}
        isOpen={true}
        onClose={mockOnClose}
        onToggle={mockOnToggle}
      />
    );
    const clearBtn = screen.getByTitle('ล้างประวัติการสนทนา');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(mockClearHistory).toHaveBeenCalledTimes(1);
  });
  it('ควรเรียก onClose เมื่อคลิกปุ่มปิด', () => {
    render(
      <AiChatPanel
        context={mockContext}
        isOpen={true}
        onClose={mockOnClose}
        onToggle={mockOnToggle}
      />
    );
    const closeBtn = screen.getByTitle('ปิดหน้าต่างแชท');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
  it('ควรตอบสนองต่อปุ่ม Suggested Action ที่ถูกส่งจากกล่องแชท AI', () => {
    vi.mocked(useAiChat).mockReturnValue({
      messages: [
        {
          id: '2',
          role: 'assistant',
          content: 'ลองคลิกตัวเลือกต่อไปนี้:',
          timestamp: '2026-05-19T00:00:00.000Z',
          suggestedActions: [{ label: 'สรุปสถานะ RFA', query: 'ช่วยสรุปสถานะ RFA นี้ให้หน่อย' }]
        }
      ],
      sendMessage: mockSendMessage,
      clearHistory: mockClearHistory,
      isLoading: false,
      isOpen: false,
      setIsOpen: vi.fn(),
      toggleOpen: vi.fn(),
    });
    render(
      <AiChatPanel
        context={mockContext}
        isOpen={true}
        onClose={mockOnClose}
        onToggle={mockOnToggle}
      />
    );
    const actionBtn = screen.getByText('สรุปสถานะ RFA');
    expect(actionBtn).toBeInTheDocument();
    fireEvent.click(actionBtn);
    expect(mockSendMessage).toHaveBeenCalledWith('ช่วยสรุปสถานะ RFA นี้ให้หน่อย');
  });
});
