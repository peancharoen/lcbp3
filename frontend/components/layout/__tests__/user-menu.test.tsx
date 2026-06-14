// File: frontend/components/layout/__tests__/user-menu.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserMenu } from '../user-menu';

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}));

import { useSession } from 'next-auth/react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

import { useRouter } from 'next/navigation';

describe('UserMenu', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });
  });

  it('ควร return null เมื่อไม่มี user', () => {
    vi.mocked(useSession).mockReturnValue({ data: null });

    const { container } = render(<UserMenu />);
    expect(container.firstChild).toBeNull();
  });

  it('ควร render user menu เมื่อมี user', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
        },
      },
    });

    render(<UserMenu />);

    const menuButton = screen.getByRole('button');
    expect(menuButton).toBeInTheDocument();
  });

  it('ควรแสดง initials จากชื่อ user', () => {
    vi.mocked(useSession).mockReturnValue({
      data: {
        user: {
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
        },
      },
    });

    render(<UserMenu />);

    expect(screen.getByText('TU')).toBeInTheDocument();
  });
});
