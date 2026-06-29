// File: frontend/components/layout/__tests__/navbar.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for Navbar component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { act } from '@testing-library/react';
import { Navbar } from '../navbar';
import { useUIStore } from '@/lib/stores/ui-store';
import { useSession } from 'next-auth/react';

// Mock dependencies
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // รีเซ็ต ui store
    act(() => {
      useUIStore.setState({ isSidebarOpen: true, toggleSidebar: vi.fn() });
    });
    vi.mocked(useSession).mockReturnValue({
      data: { user: { name: 'John Doe', email: 'john@example.com', role: 'Admin' } },
    } as any);
  });

  it('ควรเรนเดอร์ header ได้ถูกต้อง', () => {
    render(<Navbar />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  it('ควรแสดงข้อความ Document Management System', () => {
    render(<Navbar />);
    expect(screen.getByText('Document Management System')).toBeInTheDocument();
  });

  it('ควรมีปุ่ม Toggle navigation menu สำหรับ mobile', () => {
    render(<Navbar />);
    expect(screen.getByText('Toggle navigation menu')).toBeInTheDocument();
  });

  it('ควรมีปุ่ม Notifications', () => {
    render(<Navbar />);
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('ควรเรียก toggleSidebar เมื่อคลิกปุ่ม menu', () => {
    const mockToggle = vi.fn();
    act(() => {
      useUIStore.setState({ isSidebarOpen: true, toggleSidebar: mockToggle });
    });
    render(<Navbar />);
    // ปุ่ม menu บน mobile
    const menuButton = screen.getByRole('button', { name: /toggle navigation menu/i });
    fireEvent.click(menuButton);
    expect(mockToggle).toHaveBeenCalledOnce();
  });
});
