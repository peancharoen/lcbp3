// File: frontend/components/profile/__tests__/telegram-binding-card.test.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US1, T031) — tests สำหรับ TelegramBindingCard

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock hooks ก่อน import component
const mockUseTelegramStatus = vi.fn();
const mockLinkMutate = vi.fn();
const mockUnlinkMutate = vi.fn();
const mockTestMutate = vi.fn();

vi.mock('@/hooks/use-notification', () => ({
  useTelegramStatus: () => mockUseTelegramStatus(),
  useTelegramLinkToken: () => ({ mutate: mockLinkMutate, isPending: false }),
  useUnlinkTelegram: () => ({ mutate: mockUnlinkMutate, isPending: false }),
  useTelegramTestMessage: () => ({ mutate: mockTestMutate, isPending: false }),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

import { TelegramBindingCard } from '../telegram-binding-card';

describe('TelegramBindingCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง loading state ขณะรอสถานะ', () => {
    mockUseTelegramStatus.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<TelegramBindingCard />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('แสดงปุ่มเชื่อมต่อเมื่อยังไม่ได้ผูกบัญชี', () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { linked: false, telegramUsername: null, telegramLinkedAt: null },
      isLoading: false,
    });
    render(<TelegramBindingCard />);
    expect(screen.getByText('notification.telegram.notLinked')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notification\.telegram\.linkButton/ })).toBeInTheDocument();
  });

  it('เรียก link token mutation เมื่อกดปุ่มเชื่อมต่อ', () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { linked: false, telegramUsername: null, telegramLinkedAt: null },
      isLoading: false,
    });
    render(<TelegramBindingCard />);
    fireEvent.click(screen.getByRole('button', { name: /notification\.telegram\.linkButton/ }));
    expect(mockLinkMutate).toHaveBeenCalledOnce();
  });

  it('แสดง username และปุ่ม test/unlink เมื่อผูกแล้ว', () => {
    mockUseTelegramStatus.mockReturnValue({
      data: {
        linked: true,
        telegramUsername: 'somchai',
        telegramLinkedAt: '2026-09-25T10:00:00Z',
      },
      isLoading: false,
    });
    render(<TelegramBindingCard />);
    expect(screen.getByText('notification.telegram.linked')).toBeInTheDocument();
    expect(screen.getByText('@somchai')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notification\.telegram\.testButton/ })).toBeInTheDocument();
  });

  it('เรียก test message mutation เมื่อกดปุ่มทดสอบ', () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { linked: true, telegramUsername: 'somchai', telegramLinkedAt: null },
      isLoading: false,
    });
    render(<TelegramBindingCard />);
    fireEvent.click(screen.getByRole('button', { name: /notification\.telegram\.testButton/ }));
    expect(mockTestMutate).toHaveBeenCalledOnce();
  });
});
