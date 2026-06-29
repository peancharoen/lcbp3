// File: frontend/components/common/__tests__/can.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for Can component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Can } from '../can';
import { useAuthStore } from '@/lib/stores/auth-store';

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

describe('Can Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรเรนเดอร์ children เมื่อผู้ใช้มีสิทธิ์ตามที่ระบุ', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => true,
    } as any);
    render(
      <Can permission="test.permission">
        <div>Allowed Content</div>
      </Can>
    );
    expect(screen.getByText('Allowed Content')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ fallback เมื่อผู้ใช้ไม่มีสิทธิ์ตามที่ระบุ', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => false,
      hasRole: () => true,
    } as any);
    render(
      <Can permission="test.permission" fallback={<div>Access Denied</div>}>
        <div>Allowed Content</div>
      </Can>
    );
    expect(screen.queryByText('Allowed Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ children เมื่อผู้ใช้มีบทบาทตามที่ระบุ', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => true,
    } as any);
    render(
      <Can role="ADMIN">
        <div>Allowed Content</div>
      </Can>
    );
    expect(screen.getByText('Allowed Content')).toBeInTheDocument();
  });

  it('ควรเรนเดอร์ fallback เมื่อผู้ใช้ไม่มีบทบาทตามที่ระบุ', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => false,
    } as any);
    render(
      <Can role="ADMIN" fallback={<div>Access Denied</div>}>
        <div>Allowed Content</div>
      </Can>
    );
    expect(screen.queryByText('Allowed Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });
});
