// File: frontend/components/layout/__tests__/user-nav.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for UserNav component
// - 2026-06-13: Fix Radix UI DropdownMenu testing — ใช้ userEvent แทน fireEvent และ waitFor

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserNav } from '../user-nav';
import { useSession, signOut } from 'next-auth/react';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('UserNav Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'John Doe',
          email: 'john@example.com',
          role: 'Admin',
        },
      },
    } as any);
  });

  it('ควรเรนเดอร์อักษรย่อชื่อผู้ใช้ได้อย่างถูกต้อง', () => {
    render(<UserNav />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('ควรแสดงรายละเอียดผู้ใช้ใน DropdownMenuContent (forceMount)', async () => {
    render(<UserNav />);
    // DropdownMenuContent ใช้ forceMount → render อยู่ใน DOM เสมอ
    // แต่ Radix ซ่อนด้วย data-state — ต้อง click trigger ก่อน
    const user = userEvent.setup();
    const trigger = screen.getByRole('button');
    await act(async () => {
      await user.click(trigger);
    });
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });

  it('ควรเปลี่ยนเส้นทางไปหน้า Profile เมื่อคลิกเมนู Profile', async () => {
    render(<UserNav />);
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    await waitFor(() => {
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText('Profile'));
    });
    expect(mockPush).toHaveBeenCalledWith('/profile');
  });

  it('ควรเปลี่ยนเส้นทางไปหน้า Settings เมื่อคลิกเมนู Settings', async () => {
    render(<UserNav />);
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText('Settings'));
    });
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('ควรออกจากระบบและเปลี่ยนเส้นทางไปหน้า Login เมื่อคลิกเมนู Log out', async () => {
    vi.mocked(signOut).mockResolvedValue({} as any);
    render(<UserNav />);
    const user = userEvent.setup();
    await act(async () => {
      await user.click(screen.getByRole('button'));
    });
    await waitFor(() => {
      expect(screen.getByText('Log out')).toBeInTheDocument();
    });
    await act(async () => {
      await user.click(screen.getByText('Log out'));
    });
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login');
    });
  });
});
