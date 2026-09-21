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
  replaceMutate: vi.fn(),
  confirmMutate: vi.fn(),
  hasPermission: vi.fn(() => true),
  links: undefined as unknown,
}));

vi.mock('@/hooks/ai/use-re-ocr', () => ({
  useReOcrStatus: () => mocks.status,
  useReOcrTrigger: () => ({ mutate: mocks.triggerMutate, isPending: false }),
  useReOcrReplaceTrigger: () => ({
    mutate: mocks.replaceMutate,
    isPending: false,
  }),
  useReOcrConfirm: () => ({ mutate: mocks.confirmMutate, isPending: false }),
  useAttachmentLinks: () => ({ data: mocks.links }),
}));
vi.mock('../rag-console/ReOcrDiffView', () => ({
  ReOcrDiffView: ({ currentText, newText }: { currentText: string; newText: string }) => (
    <div data-testid="diff">{`${currentText}|${newText}`}</div>
  ),
}));
vi.mock('../rag-console/ReOcrReplacePicker', () => ({
  ReOcrReplacePicker: ({
    onChange,
  }: {
    onChange: (s: { storageTempPath: string; filename: string }) => void;
  }) => (
    <button
      data-testid="pick-file"
      onClick={() =>
        onChange({ storageTempPath: '/staging/new.pdf', filename: 'new.pdf' })
      }
    >
      pick
    </button>
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

describe('ReOcrDialog — replace mode (ADR-055 D17–D22)', () => {
  const linkCurrent = {
    correspondencePublicId: 'corr-1',
    correspondenceNumber: 'คคง.-สคฉ.3-03-21-0004-2567',
    revisionPublicId: 'rev-1',
    revisionNumber: 3,
    isCurrent: true,
    isMainDocument: true,
  };
  const linkOld = {
    correspondencePublicId: 'corr-2',
    correspondenceNumber: 'คคง.-ผรม.2-1-0007-2567',
    revisionPublicId: 'rev-0',
    revisionNumber: 1,
    isCurrent: false,
    isMainDocument: false,
  };

  const renderReplace = (extra: Record<string, unknown> = {}) =>
    render(
      <ReOcrDialog
        attachmentPublicId="att-1"
        originalFilename="a.pdf"
        open
        onOpenChange={vi.fn()}
        replaceEnabled
        {...extra}
      />
    );

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.status = { data: null, isLoading: false };
    mocks.hasPermission.mockReturnValue(true);
    mocks.links = [linkCurrent, linkOld];
  });

  it('link picker: เลือกได้เฉพาะ link ที่เป็น current revision; start ปิดจนกว่าจะเลือก link + ไฟล์', async () => {
    renderReplace();
    expect(screen.getByText(ragAdminT('re_ocr.replace.link_picker'))).toBeInTheDocument();
    const linkRadios = screen
      .getAllByRole('radio')
      .filter((r) => r.getAttribute('name') === 're-ocr-target-link');
    expect(linkRadios).toHaveLength(2);
    expect(linkRadios[1]).toBeDisabled(); // non-current link
    const startBtn = screen.getByRole('button', {
      name: ragAdminT('re_ocr.replace.start'),
    });
    expect(startBtn).toBeDisabled();
    await userEvent.click(linkRadios[0]);
    expect(startBtn).toBeDisabled(); // ยังไม่เลือกไฟล์
    await userEvent.click(screen.getByTestId('pick-file'));
    expect(startBtn).toBeEnabled();
    await userEvent.click(startBtn);
    expect(mocks.replaceMutate).toHaveBeenCalledWith(
      {
        engineType: 'np-dms-ocr',
        targetCorrespondencePublicId: 'corr-1',
        storageTempPath: '/staging/new.pdf',
        tempAttachmentPublicId: undefined,
      },
      expect.any(Object)
    );
    expect(mocks.triggerMutate).not.toHaveBeenCalled();
  });

  it('preselect link (detail page) → แสดง link_fixed ไม่มี link picker', () => {
    renderReplace({ replaceTargetCorrespondencePublicId: 'corr-1' });
    expect(screen.getByText(ragAdminT('re_ocr.replace.link_fixed'))).toBeInTheDocument();
    expect(
      screen.queryByText(ragAdminT('re_ocr.replace.link_picker'))
    ).not.toBeInTheDocument();
  });

  it('resume failed replace job → retry ใช้ candidate เดิมจาก status (ไม่ต้องเลือกใหม่)', async () => {
    mocks.status = {
      data: {
        ...base,
        status: 'failed',
        mode: 'replace',
        errorMessage: 'engine คืนผลลัพธ์ว่างเปล่า',
        targetCorrespondencePublicId: 'corr-1',
        candidateAttachmentPublicId: 'cand-1',
        candidateFilename: 'new.pdf',
      },
      isLoading: false,
    };
    renderReplace();
    await userEvent.click(
      screen.getByRole('button', { name: ragAdminT('re_ocr.error.retry_np_dms_ocr') })
    );
    expect(mocks.replaceMutate).toHaveBeenCalledWith(
      {
        engineType: 'np-dms-ocr',
        targetCorrespondencePublicId: 'corr-1',
        tempAttachmentPublicId: 'cand-1',
      },
      expect.any(Object)
    );
    expect(mocks.triggerMutate).not.toHaveBeenCalled();
  });

  it('completed replace → candidate label + filename-mismatch warning เมื่อชื่อไฟล์ต่าง', () => {
    mocks.status = {
      data: completed({
        mode: 'replace',
        candidateFilename: 'different.pdf',
        candidateAttachmentPublicId: 'cand-1',
        targetCorrespondencePublicId: 'corr-1',
      }),
      isLoading: false,
    };
    renderReplace();
    const warning = screen.getByTestId('filename-mismatch');
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent('different.pdf');
    expect(warning).toHaveTextContent('a.pdf');
  });

  it('completed replace ที่ชื่อไฟล์ตรง → ไม่แสดง mismatch warning', () => {
    mocks.status = {
      data: completed({
        mode: 'replace',
        candidateFilename: 'a.pdf',
        candidateAttachmentPublicId: 'cand-1',
        targetCorrespondencePublicId: 'corr-1',
      }),
      isLoading: false,
    };
    renderReplace();
    expect(screen.queryByTestId('filename-mismatch')).not.toBeInTheDocument();
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
