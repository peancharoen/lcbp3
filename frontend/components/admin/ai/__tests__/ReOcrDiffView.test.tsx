// File: frontend/components/admin/ai/__tests__/ReOcrDiffView.test.tsx
// Change Log:
// - 2026-09-19: ADR-055 T025 — placeholder เมื่อไม่มี OCR text เดิม, จำนวนตัวอักษร, search-in-pane

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReOcrDiffView } from '../rag-console/ReOcrDiffView';
import { ragAdminT } from '../rag-console/rag-admin-i18n';

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
});
