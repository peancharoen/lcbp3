// File: frontend/components/admin/ai/__tests__/ReOcrDiffView.test.tsx
// Change Log:
// - 2026-09-19: ADR-055 T025 — placeholder เมื่อไม่มี OCR text เดิม, จำนวนตัวอักษร, search-in-pane

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReOcrDiffView } from '../rag-console/ReOcrDiffView';
import { ragAdminT } from '../rag-console/rag-admin-i18n';

import apiClient from '@/lib/api/client';

vi.mock('@/lib/api/client', () => ({
  default: { get: vi.fn(() => new Promise(() => undefined)) },
}));

const renderView = (currentText: string, newText: string) =>
  render(
    <ReOcrDiffView
      attachmentPublicId="att-1"
      currentText={currentText}
      newText={newText}
      engineUsed="np-dms-ocr"
    />
  );

describe('ReOcrDiffView', () => {
  it('ocr_text เดิมว่าง → ฝั่งซ้ายแสดง placeholder (ไม่ใช่ error)', () => {
    renderView('', 'new text');
    expect(screen.getByText(ragAdminT('re_ocr.diff.no_current'))).toBeInTheDocument();
    expect(screen.getByText('new text')).toBeInTheDocument();
  });

  it('แสดงจำนวนตัวอักษรเดิม/ใหม่', () => {
    renderView('abc', 'abcdef');
    expect(screen.getByText(ragAdminT('re_ocr.diff.chars', { count: 3 }))).toBeInTheDocument();
    expect(screen.getByText(ragAdminT('re_ocr.diff.chars', { count: 6 }))).toBeInTheDocument();
  });

  it('search box ต่อ pane: พิมพ์คำค้น → highlight เฉพาะ pane นั้น + นับจำนวน', async () => {
    renderView('LCBP3-001 and LCBP3-002', 'LCBP3-001 only');
    const inputs = screen.getAllByRole('textbox');
    await userEvent.type(inputs[0], 'LCBP3');
    expect(screen.getAllByTestId('re-ocr-match')).toHaveLength(2);
    expect(screen.getByTestId('re-ocr-match-count')).toHaveTextContent('2');
  });

  it('ไม่มี candidatePublicId → ไม่แสดง PDF toggle (โหมด re-OCR ปกติ)', () => {
    renderView('old', 'new');
    expect(screen.queryByTestId('pdf-toggle-new')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-toggle-old')).not.toBeInTheDocument();
  });

  it('replace mode: default = ไฟล์ใหม่ (candidate) และ toggle ไปไฟล์เดิมได้ (D22/Q7)', async () => {
    vi.mocked(apiClient.get).mockClear();
    render(
      <ReOcrDiffView
        attachmentPublicId="att-1"
        candidatePublicId="cand-1"
        currentText="old"
        newText="new"
        engineUsed="np-dms-ocr"
      />
    );
    // default = new → fetch candidate
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/files/cand-1/re-ocr/preview',
      expect.any(Object)
    );
    await userEvent.click(screen.getByTestId('pdf-toggle-old'));
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/files/att-1/re-ocr/preview',
      expect.any(Object)
    );
    await userEvent.click(screen.getByTestId('pdf-toggle-new'));
    expect(apiClient.get).toHaveBeenLastCalledWith(
      '/files/cand-1/re-ocr/preview',
      expect.any(Object)
    );
  });
});
