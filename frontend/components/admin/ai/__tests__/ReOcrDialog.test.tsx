// File: frontend/components/admin/ai/__tests__/ReOcrDialog.test.tsx
// Change Log:
// - 2026-09-19: ADR-055 T028/T030 — resume-by-click phases, identical disables confirm, AlertDialog gate,
//   failed view retry buttons (trigger ใหม่ตาม engine ที่เลือก), ปุ่ม Re-OCR ซ่อนเมื่อไม่มีสิทธิ์/ไม่ใช่ PDF

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReOcrDialog } from '../rag-console/ReOcrDialog';
import { ReOcrButton } from '../rag-console/ReOcrButton';
import { ragAdminT } from '../rag-console/rag-admin-i18n';
import type { ReOcrStatusResponse } from '@/lib/services/re-ocr.service';

const mocks = vi.hoisted(() => ({
  status: { data: null as unknown, isLoading: false },
  triggerMutate: vi.fn(),
  confirmMutate: vi.fn(),
  hasPermission: vi.fn(() => true),
}));

vi.mock('@/hooks/ai/use-re-ocr', () => ({
  useReOcrStatus: () => mocks.status,
  useReOcrTrigger: () => ({ mutate: mocks.triggerMutate, isPending: false }),
  useReOcrConfirm: () => ({ mutate: mocks.confirmMutate, isPending: false }),
}));
vi.mock('../rag-console/ReOcrDiffView', () => ({
  ReOcrDiffView: ({ currentText, newText }: { currentText: string; newText: string }) => (
    <div data-testid="diff">{`${currentText}|${newText}`}</div>
  ),
}));
vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: (sel: (s: { hasPermission: (p: string) => boolean }) => unknown) =>
    sel({ hasPermission: mocks.hasPermission }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const base = {
  reOcrToken: 'tok',
  triggeredByDisplayName: 'Admin A',
  triggeredAt: '2026-09-19T00:00:00.000Z',
};
const completed = (over: Record<string, unknown> = {}): ReOcrStatusResponse =>
  ({
    ...base,
    status: 'completed',
    newText: 'new text',
    currentText: 'old text',
    engineUsed: 'np-dms-ocr',
    charCount: 8,
    processingTimeMs: 10,
    identical: false,
    ...over,
  }) as ReOcrStatusResponse;

const renderDialog = () =>
  render(
    <ReOcrDialog attachmentPublicId="att-1" originalFilename="a.pdf" open onOpenChange={vi.fn()} />
  );

describe('ReOcrDialog (ADR-055 D16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = { data: null, isLoading: false };
    mocks.hasPermission.mockReturnValue(true);
  });

  it('ไม่มี job (404 → null) → เข้า phase เลือก engine; default np-dms-ocr; กดเริ่ม = trigger', async () => {
    renderDialog();
    expect(screen.getByText(ragAdminT('re_ocr.select.heading'))).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: ragAdminT('re_ocr.select.start') }));
    expect(mocks.triggerMutate).toHaveBeenCalledWith('np-dms-ocr', expect.any(Object));
  });

  it('queued/processing → phase รอ (ไม่ trigger ซ้ำ) พร้อม "เริ่มโดย"', () => {
    mocks.status = {
      data: { ...base, status: 'processing', jobId: 'j', engineType: 'auto', attempt: 2 },
      isLoading: false,
    };
    renderDialog();
    expect(screen.getByText(new RegExp(ragAdminT('re_ocr.waiting.processing')))).toBeInTheDocument();
    expect(screen.getByText(/Admin A/)).toBeInTheDocument();
    expect(mocks.triggerMutate).not.toHaveBeenCalled();
  });

  it('completed → เปิด diff phase ทันที (resume-by-click) โดยไม่ trigger', () => {
    mocks.status = { data: completed(), isLoading: false };
    renderDialog();
    expect(screen.getByTestId('diff')).toHaveTextContent('old text|new text');
    expect(mocks.triggerMutate).not.toHaveBeenCalled();
  });

  it('identical → แสดง notice และปิดปุ่ม confirm', () => {
    mocks.status = { data: completed({ identical: true }), isLoading: false };
    renderDialog();
    expect(screen.getByText(ragAdminT('re_ocr.diff.identical'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: ragAdminT('re_ocr.diff.confirm') })).toBeDisabled();
  });

  it('warning RESULT_MUCH_SHORTER → badge เตือน แต่ยัง confirm ได้', () => {
    mocks.status = { data: completed({ warning: 'RESULT_MUCH_SHORTER' }), isLoading: false };
    renderDialog();
    expect(screen.getByRole('alert')).toHaveTextContent(ragAdminT('re_ocr.diff.much_shorter'));
    expect(screen.getByRole('button', { name: ragAdminT('re_ocr.diff.confirm') })).toBeEnabled();
  });

  it('confirm ต้องผ่าน AlertDialog ก่อน: กดปุ่มหลักยังไม่ยิง API; ยืนยันใน AlertDialog แล้วจึงยิง', async () => {
    mocks.status = { data: completed(), isLoading: false };
    renderDialog();
    await userEvent.click(screen.getByRole('button', { name: ragAdminT('re_ocr.diff.confirm') }));
    expect(mocks.confirmMutate).not.toHaveBeenCalled();
    expect(screen.getByText(ragAdminT('re_ocr.confirm_dialog.title'))).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: ragAdminT('re_ocr.confirm_dialog.confirm') })
    );
    expect(mocks.confirmMutate).toHaveBeenCalledWith('tok', expect.any(Object));
  });

  it('failed → errorMessage + ปุ่ม retry 2 แบบ; แต่ละปุ่ม trigger ใหม่ด้วย engine ที่เลือก', async () => {
    mocks.status = {
      data: { ...base, status: 'failed', errorMessage: 'engine คืนผลลัพธ์ว่างเปล่า' },
      isLoading: false,
    };
    renderDialog();
    expect(screen.getByText('engine คืนผลลัพธ์ว่างเปล่า')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: ragAdminT('re_ocr.error.retry_auto') }));
    expect(mocks.triggerMutate).toHaveBeenLastCalledWith('auto', expect.any(Object));
    await userEvent.click(
      screen.getByRole('button', { name: ragAdminT('re_ocr.error.retry_np_dms_ocr') })
    );
    expect(mocks.triggerMutate).toHaveBeenLastCalledWith('np-dms-ocr', expect.any(Object));
  });
});

describe('ReOcrButton', () => {
  beforeEach(() => mocks.hasPermission.mockReturnValue(true));

  it('แสดงสำหรับ PDF + มีสิทธิ์ rag.admin.write', () => {
    render(<ReOcrButton attachmentPublicId="a" originalFilename="a.pdf" mimeType="application/pdf" />);
    expect(screen.getByRole('button', { name: ragAdminT('re_ocr.action') })).toBeInTheDocument();
  });
  it('ซ่อนเมื่อไม่มีสิทธิ์', () => {
    mocks.hasPermission.mockReturnValue(false);
    const { container } = render(
      <ReOcrButton attachmentPublicId="a" originalFilename="a.pdf" mimeType="application/pdf" />
    );
    expect(container).toBeEmptyDOMElement();
  });
  it('ซ่อนเมื่อไม่ใช่ PDF', () => {
    const { container } = render(
      <ReOcrButton attachmentPublicId="a" originalFilename="a.zip" mimeType="application/zip" />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
