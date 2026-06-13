// File: frontend/lib/stores/__tests__/ui-store.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useUIStore (Zustand)

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useUIStore } from '../ui-store';

describe('useUIStore', () => {
  beforeEach(() => {
    // รีเซ็ต store ก่อนแต่ละ test
    act(() => {
      useUIStore.setState({ isSidebarOpen: true });
    });
  });

  it('ค่า default ควรเป็น isSidebarOpen: true', () => {
    const { result } = renderHook(() => useUIStore());
    expect(result.current.isSidebarOpen).toBe(true);
  });

  it('toggleSidebar ควรสลับค่า isSidebarOpen จาก true เป็น false', () => {
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('toggleSidebar ควรสลับค่า isSidebarOpen จาก false เป็น true', () => {
    act(() => {
      useUIStore.setState({ isSidebarOpen: false });
    });
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.toggleSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);
  });

  it('closeSidebar ควรตั้งค่า isSidebarOpen เป็น false', () => {
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.closeSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(false);
  });

  it('openSidebar ควรตั้งค่า isSidebarOpen เป็น true', () => {
    act(() => {
      useUIStore.setState({ isSidebarOpen: false });
    });
    const { result } = renderHook(() => useUIStore());
    act(() => {
      result.current.openSidebar();
    });
    expect(result.current.isSidebarOpen).toBe(true);
  });
});
