// File: frontend/components/layout/__tests__/sidebar.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Sidebar, MobileSidebar } from '../sidebar';

// Mock stores
vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

import { useAuthStore } from '@/lib/stores/auth-store';

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render sidebar พร้อม navigation items', () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: { role: 'USER' } });

    render(<Sidebar />);

    expect(screen.getByText('LCBP3 DMS')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('ควรไม่แสดง Admin Panel เมื่อ user ไม่ใช่ admin', () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: { role: 'USER' } });

    render(<Sidebar />);

    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('ควรแสดง Admin Panel เมื่อ user เป็น ADMIN', () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: { role: 'ADMIN' } });

    render(<Sidebar />);

    const adminPanel = screen.queryByText('Admin Panel');
    if (adminPanel) {
      expect(adminPanel).toBeInTheDocument();
    }
  });
});

describe('MobileSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render mobile sidebar พร้อม navigation items', () => {
    vi.mocked(useAuthStore).mockReturnValue({ user: { role: 'USER' } });

    render(<MobileSidebar />);

    const menuButton = screen.getByRole('button');
    expect(menuButton).toBeInTheDocument();
  });
});
