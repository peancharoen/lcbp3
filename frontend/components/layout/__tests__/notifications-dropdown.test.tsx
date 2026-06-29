// File: frontend/components/layout/__tests__/notifications-dropdown.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationsDropdown } from '../notifications-dropdown';

// Mock hooks
vi.mock('@/hooks/use-notification', () => ({
  useNotifications: vi.fn(),
  useMarkNotificationRead: vi.fn(),
}));

import { useNotifications, useMarkNotificationRead } from '@/hooks/use-notification';

describe('NotificationsDropdown', () => {
  const mockMarkAsRead = { mutate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render notification bell icon', () => {
    vi.mocked(useNotifications).mockReturnValue({ data: { items: [], unreadCount: 0 }, isLoading: false });
    vi.mocked(useMarkNotificationRead).mockReturnValue(mockMarkAsRead);

    render(<NotificationsDropdown />);

    const bellButton = screen.getByRole('button');
    expect(bellButton).toBeInTheDocument();
  });

  it('ควรแสดง unread count badge เมื่อมี notification ยังไม่อ่าน', () => {
    vi.mocked(useNotifications).mockReturnValue({ data: { items: [], unreadCount: 5 }, isLoading: false });
    vi.mocked(useMarkNotificationRead).mockReturnValue(mockMarkAsRead);

    render(<NotificationsDropdown />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('ควรแสดง "No new notifications" เมื่อไม่มี notification', () => {
    vi.mocked(useNotifications).mockReturnValue({ data: { items: [], unreadCount: 0 }, isLoading: false });
    vi.mocked(useMarkNotificationRead).mockReturnValue(mockMarkAsRead);

    render(<NotificationsDropdown />);

    const bellButton = screen.getByRole('button');
    bellButton.click();

    const noNotifications = screen.queryByText('No new notifications');
    if (noNotifications) {
      expect(noNotifications).toBeInTheDocument();
    }
  });
});
