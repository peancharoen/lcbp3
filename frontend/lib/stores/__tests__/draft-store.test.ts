// File: frontend/lib/stores/__tests__/draft-store.test.ts
// Change Log:
// - 2026-06-13: Initial creation - test coverage for useDraftStore (Zustand)

import { describe, it, expect, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDraftStore } from '../draft-store';

describe('useDraftStore', () => {
  beforeEach(() => {
    // รีเซ็ต store ก่อนแต่ละ test
    act(() => {
      useDraftStore.setState({ drafts: {} });
    });
  });

  it('ค่า default ควรเป็น drafts: {}', () => {
    const { result } = renderHook(() => useDraftStore());
    expect(result.current.drafts).toEqual({});
  });

  it('saveDraft ควรบันทึก draft data ด้วย key ที่กำหนด', () => {
    const { result } = renderHook(() => useDraftStore());
    const draftData = { title: 'Test Document', projectId: '019505a1-7c3e-7000-8000-abc123def456' };
    act(() => {
      result.current.saveDraft('rfa-new', draftData);
    });
    expect(result.current.drafts['rfa-new']).toEqual(draftData);
  });

  it('getDraft ควรดึงข้อมูล draft ตาม key', () => {
    const { result } = renderHook(() => useDraftStore());
    const draftData = { subject: 'Correspondence Test', content: 'Body text' };
    act(() => {
      result.current.saveDraft('corr-edit', draftData);
    });
    const retrieved = result.current.getDraft('corr-edit');
    expect(retrieved).toEqual(draftData);
  });

  it('getDraft ควร return undefined หาก key ไม่มีใน store', () => {
    const { result } = renderHook(() => useDraftStore());
    const retrieved = result.current.getDraft('non-existent-key');
    expect(retrieved).toBeUndefined();
  });

  it('clearDraft ควรลบ draft ออกตาม key', () => {
    const { result } = renderHook(() => useDraftStore());
    act(() => {
      result.current.saveDraft('rfa-draft', { title: 'To Delete' });
    });
    expect(result.current.drafts['rfa-draft']).toBeDefined();
    act(() => {
      result.current.clearDraft('rfa-draft');
    });
    expect(result.current.drafts['rfa-draft']).toBeUndefined();
  });

  it('saveDraft ไม่ควรลบ draft อื่นที่ไม่ใช่ key เดียวกัน', () => {
    const { result } = renderHook(() => useDraftStore());
    act(() => {
      result.current.saveDraft('key-a', { data: 'A' });
      result.current.saveDraft('key-b', { data: 'B' });
    });
    act(() => {
      result.current.clearDraft('key-a');
    });
    expect(result.current.drafts['key-a']).toBeUndefined();
    expect(result.current.drafts['key-b']).toEqual({ data: 'B' });
  });
});
