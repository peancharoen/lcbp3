// File: frontend/lib/stores/__tests__/project-store.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useProjectStore (Zustand)

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useProjectStore } from '../project-store';

describe('useProjectStore', () => {
  beforeEach(() => {
    // รีเซ็ต store ก่อนแต่ละ test
    act(() => {
      useProjectStore.setState({ selectedProjectId: null });
    });
  });

  it('ค่า default ควรเป็น selectedProjectId: null', () => {
    const { result } = renderHook(() => useProjectStore());
    expect(result.current.selectedProjectId).toBeNull();
  });

  it('setSelectedProjectId ควรตั้งค่า selectedProjectId ด้วย UUIDv7 ที่กำหนด', () => {
    const { result } = renderHook(() => useProjectStore());
    const projectId = '019505a1-7c3e-7000-8000-abc123def456';
    act(() => {
      result.current.setSelectedProjectId(projectId);
    });
    expect(result.current.selectedProjectId).toBe(projectId);
  });

  it('setSelectedProjectId ควรเปลี่ยน selectedProjectId จาก UUID เป็น null ได้', () => {
    const projectId = '019505a1-7c3e-7000-8000-abc123def456';
    act(() => {
      useProjectStore.setState({ selectedProjectId: projectId });
    });
    const { result } = renderHook(() => useProjectStore());
    act(() => {
      result.current.setSelectedProjectId(null);
    });
    expect(result.current.selectedProjectId).toBeNull();
  });

  it('setSelectedProjectId ควรเปลี่ยน project ได้หลายครั้ง', () => {
    const { result } = renderHook(() => useProjectStore());
    const projectId1 = '019505a1-7c3e-7000-8000-abc123def001';
    const projectId2 = '019505a1-7c3e-7000-8000-abc123def002';
    act(() => {
      result.current.setSelectedProjectId(projectId1);
    });
    expect(result.current.selectedProjectId).toBe(projectId1);
    act(() => {
      result.current.setSelectedProjectId(projectId2);
    });
    expect(result.current.selectedProjectId).toBe(projectId2);
  });
});
