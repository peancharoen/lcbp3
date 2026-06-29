// File: frontend/lib/stores/__tests__/auth-store.test.ts
// Change Log:
// - 2026-06-14: Add coverage for auth state transitions and permission helpers

import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore, User } from '../auth-store';

const user: User = {
  id: '019505a1-7c3e-7000-8000-abc123def100',
  publicId: '019505a1-7c3e-7000-8000-abc123def100',
  username: 'frontend.tester',
  email: 'tester@example.local',
  firstName: 'Frontend',
  lastName: 'Tester',
  role: 'User',
  permissions: ['documents.read', 'workflow.execute'],
  primaryOrganizationName: 'NP DMS',
};

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
    });
  });

  it('ควรมีค่า default เป็นสถานะยังไม่ authenticated', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('setAuth ควรบันทึก user, token และสถานะ authenticated', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(user, 'access-token');
    });
    expect(result.current.user?.publicId).toBe(user.publicId);
    expect(result.current.token).toBe('access-token');
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('logout ควรล้างข้อมูล session ออกจาก store', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth(user, 'access-token');
      result.current.logout();
    });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('hasPermission ควรตรวจ permission ของ user ปัจจุบัน', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.hasPermission('documents.read')).toBe(false);
    act(() => {
      result.current.setAuth(user, 'access-token');
    });
    expect(result.current.hasPermission('documents.read')).toBe(true);
    expect(result.current.hasPermission('admin.manage')).toBe(false);
  });

  it('hasPermission ควรให้ Admin ผ่านทุก permission', () => {
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.setAuth({ ...user, role: 'admin', permissions: [] }, 'access-token');
    });
    expect(result.current.hasPermission('admin.manage')).toBe(true);
  });

  it('hasRole ควรเทียบ role แบบตรงตัวกับ user ปัจจุบัน', () => {
    const { result } = renderHook(() => useAuthStore());
    expect(result.current.hasRole('User')).toBe(false);
    act(() => {
      result.current.setAuth(user, 'access-token');
    });
    expect(result.current.hasRole('User')).toBe(true);
    expect(result.current.hasRole('Admin')).toBe(false);
  });
});
