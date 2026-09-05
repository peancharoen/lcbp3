// File: frontend/hooks/__tests__/use-cold-start-hint.test.ts
// Change Log:
// - 2026-09-05: สร้าง Unit Test สำหรับ useColdStartHint (ADR-051 D2)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useColdStartHint } from '../use-cold-start-hint';

describe('useColdStartHint hook (ADR-051 D2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it('ควรคืน false เมื่อไม่ได้รออยู่', () => {
    const { result } = renderHook(() => useColdStartHint(false));
    expect(result.current).toBe(false);
  });
  it('ควรคืน false ก่อนครบ threshold แม้กำลังรออยู่', () => {
    const { result } = renderHook(() => useColdStartHint(true));
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(result.current).toBe(false);
  });
  it('ควรคืน true เมื่อรอต่อเนื่องครบ threshold (น่าจะ cold-start)', () => {
    const { result } = renderHook(() => useColdStartHint(true));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(true);
  });
  it('ควร reset กลับเป็น false เมื่อ request เสร็จก่อนครบ threshold', () => {
    const { result, rerender } = renderHook(
      ({ waiting }) => useColdStartHint(waiting),
      { initialProps: { waiting: true } }
    );
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    rerender({ waiting: false });
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current).toBe(false);
  });
  it('ควร reset กลับเป็น false หลัง request เสร็จ แม้เคยแสดง hint แล้ว', () => {
    const { result, rerender } = renderHook(
      ({ waiting }) => useColdStartHint(waiting),
      { initialProps: { waiting: true } }
    );
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(true);
    rerender({ waiting: false });
    expect(result.current).toBe(false);
  });
  it('ควรรองรับ delayMs ที่กำหนดเอง', () => {
    const { result } = renderHook(() => useColdStartHint(true, 2000));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(true);
  });
});
