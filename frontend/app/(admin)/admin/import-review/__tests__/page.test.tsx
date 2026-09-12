// File: app/(admin)/admin/import-review/__tests__/page.test.tsx
// Change Log:
// - 2026-09-09: Initial creation — test coverage for Excel Import Review page
//   (Feature 252, ADR-052, T029)

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ImportReviewPage from '../page';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useProjectStore } from '@/lib/stores/project-store';
import { importReviewService } from '@/lib/services/import-review.service';
import type { CheckReviewResponse, ConfirmReviewResponse, ReviewStatusResponse } from '@/types/import-review';

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/lib/stores/project-store', () => ({
  useProjectStore: vi.fn(),
}));

vi.mock('@/lib/services/import-review.service', () => ({
  importReviewService: {
    check: vi.fn(),
    getStatus: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
    downloadAnnotated: vi.fn(),
    downloadFailedRows: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

const SESSION_ID = '019505a1-7c3e-7000-8000-item111111111';

describe('ImportReviewPage', () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <ImportReviewPage />
      </QueryClientProvider>
    );

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    window.PointerEvent = MouseEvent as unknown as typeof PointerEvent;
    vi.mocked(useProjectStore).mockReturnValue({
      selectedProjectId: 'proj-1',
      setSelectedProjectId: vi.fn(),
    } as unknown as ReturnType<typeof useProjectStore>);
  });

  it('ควรแสดงข้อความไม่มีสิทธิ์ เมื่อผู้ใช้ไม่มี permission correspondence.import_review', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => false,
      hasRole: () => false,
    } as unknown as ReturnType<typeof useAuthStore>);

    renderPage();

    expect(screen.getByText(/ไม่มีสิทธิ์เข้าถึงหน้านี้/)).toBeInTheDocument();
  });

  it('ควรซ่อนตัวเลือก MIGRATION_STAGING และ External AI สำหรับผู้ใช้ที่ไม่ใช่ Admin (D7, D2)', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => false,
    } as unknown as ReturnType<typeof useAuthStore>);

    renderPage();

    // เปิด dropdown ทั้งสองตัว (Radix เรนเดอร์ options เข้า document.body ผ่าน portal)
    // ลำดับใน DOM: [0] โหมดปลายทาง, [1] AI Reviewer, [2] Batch Strategy
    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.click(comboboxes[0]);
    fireEvent.click(comboboxes[1]);

    expect(screen.queryByText(/Migration Staging/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Google Gemini/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Anthropic Claude/)).not.toBeInTheDocument();
  });

  it('ควรแสดงตัวเลือก MIGRATION_STAGING และ External AI สำหรับ Admin', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: (role: string) => role === 'Admin',
    } as unknown as ReturnType<typeof useAuthStore>);

    renderPage();

    const comboboxes = screen.getAllByRole('combobox');
    fireEvent.click(comboboxes[0]);
    expect(screen.getByText(/Migration Staging/)).toBeInTheDocument();

    fireEvent.click(comboboxes[1]);
    expect(screen.getByText(/Google Gemini/)).toBeInTheDocument();
    expect(screen.getByText(/Anthropic Claude/)).toBeInTheDocument();
  });

  it('ควรอัปโหลดไฟล์และแสดงผลการตรวจสอบเมื่อสำเร็จ', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => false,
    } as unknown as ReturnType<typeof useAuthStore>);

    const mockResult: CheckReviewResponse = {
      reviewSessionPublicId: SESSION_ID,
      targetMode: 'DIRECT_IMPORT',
      totalRows: 10,
      passCount: 8,
      warnCount: 2,
      blockCount: 0,
      aiSuggestCount: 1,
      canConfirm: true,
      downloadAnnotatedUrl: 'x',
      findings: [{ row: 3, column: 'B', level: 'WARN', message: 'ตัวอย่างคำเตือน', originalValue: 'a' }],
      aiAvailable: true,
      aiReviewedRowCount: 10,
      aiSamplingMode: 'FULL',
    };
    // Async pattern: check() คืน sessionId ทันที, getStatus() คืน result เมื่อ READY
    vi.mocked(importReviewService.check).mockResolvedValue({
      reviewSessionPublicId: SESSION_ID,
      status: 'PENDING',
      statusUrl: `/api/v1/correspondence/import-review/${SESSION_ID}/status`,
    });
    const mockStatus: ReviewStatusResponse = {
      reviewSessionPublicId: SESSION_ID,
      status: 'READY',
      result: mockResult,
    };
    vi.mocked(importReviewService.getStatus).mockResolvedValue(mockStatus);

    renderPage();

    const fileInput = screen.getByLabelText(/ไฟล์ \(\.xlsx หรือ \.zip\)/) as HTMLInputElement;
    const file = new File(['dummy'], 'register.xlsx', { type: 'application/vnd.openxmlformats' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const uploadButton = screen.getByRole('button', { name: /อัปโหลดและตรวจสอบ/ });
    fireEvent.click(uploadButton);

    await waitFor(() => {
      expect(importReviewService.check).toHaveBeenCalledWith(
        expect.objectContaining({ projectPublicId: 'proj-1', targetMode: 'DIRECT_IMPORT' })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('ตัวอย่างคำเตือน')).toBeInTheDocument();
    });

    // canConfirm = true -> ปุ่มยืนยันไม่ถูก disable
    expect(screen.getByRole('button', { name: /ยืนยันนำเข้า/ })).not.toBeDisabled();
  });

  it('ควร disable ปุ่มยืนยันเมื่อมีแถวติด BLOCK (canConfirm = false)', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: () => false,
    } as unknown as ReturnType<typeof useAuthStore>);

    const mockResult: CheckReviewResponse = {
      reviewSessionPublicId: SESSION_ID,
      targetMode: 'DIRECT_IMPORT',
      totalRows: 10,
      passCount: 8,
      warnCount: 1,
      blockCount: 1,
      aiSuggestCount: 0,
      canConfirm: false,
      downloadAnnotatedUrl: 'x',
      findings: [],
      aiAvailable: true,
      aiReviewedRowCount: 10,
      aiSamplingMode: 'FULL',
    };
    vi.mocked(importReviewService.check).mockResolvedValue({
      reviewSessionPublicId: SESSION_ID,
      status: 'PENDING',
      statusUrl: `/api/v1/correspondence/import-review/${SESSION_ID}/status`,
    });
    vi.mocked(importReviewService.getStatus).mockResolvedValue({
      reviewSessionPublicId: SESSION_ID,
      status: 'READY',
      result: mockResult,
    });

    renderPage();

    const fileInput = screen.getByLabelText(/ไฟล์ \(\.xlsx หรือ \.zip\)/) as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'a.xlsx')] } });
    fireEvent.click(screen.getByRole('button', { name: /อัปโหลดและตรวจสอบ/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ยืนยันนำเข้า/ })).toBeDisabled();
    });
    expect(screen.getByText(/ไม่สามารถยืนยันนำเข้าได้/)).toBeInTheDocument();
  });

  it('ควรแสดงลิงก์ดาวน์โหลด failed_rows.xlsx หลัง confirm เมื่อมีแถวถูกกักกัน (US3, D6)', async () => {
    vi.mocked(useAuthStore).mockReturnValue({
      hasPermission: () => true,
      hasRole: (role: string) => role === 'Admin',
    } as unknown as ReturnType<typeof useAuthStore>);

    const mockResult: CheckReviewResponse = {
      reviewSessionPublicId: SESSION_ID,
      targetMode: 'MIGRATION_STAGING',
      totalRows: 10,
      passCount: 10,
      warnCount: 0,
      blockCount: 0,
      aiSuggestCount: 0,
      canConfirm: true,
      downloadAnnotatedUrl: 'x',
      findings: [],
      aiAvailable: true,
      aiReviewedRowCount: 10,
      aiSamplingMode: 'FULL',
    };
    const mockConfirmResponse: ConfirmReviewResponse = {
      reviewSessionPublicId: SESSION_ID,
      batchId: 'batch-99',
      targetMode: 'MIGRATION_STAGING',
      totalRows: 10,
      enqueuedCount: 8,
      quarantinedCount: 2,
      failedRowsDownloadUrl: `/api/v1/correspondence/import-review/${SESSION_ID}/download-failed-rows`,
      status: 'CONFIRMED',
    };
    // Async pattern: check() คืน sessionId, getStatus() คืน result เมื่อ READY
    vi.mocked(importReviewService.check).mockResolvedValue({
      reviewSessionPublicId: SESSION_ID,
      status: 'PENDING',
      statusUrl: `/api/v1/correspondence/import-review/${SESSION_ID}/status`,
    });
    vi.mocked(importReviewService.getStatus).mockResolvedValue({
      reviewSessionPublicId: SESSION_ID,
      status: 'READY',
      result: mockResult,
    });
    vi.mocked(importReviewService.confirm).mockResolvedValue(mockConfirmResponse);

    renderPage();

    fireEvent.change(screen.getByLabelText(/ไฟล์ \(\.xlsx หรือ \.zip\)/), {
      target: { files: [new File(['x'], 'a.xlsx')] },
    });
    fireEvent.click(screen.getByRole('button', { name: /อัปโหลดและตรวจสอบ/ }));

    await waitFor(() => expect(screen.getByRole('button', { name: /ยืนยันนำเข้า/ })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: /ยืนยันนำเข้า/ }));

    await waitFor(() => {
      expect(screen.getByText(/มี 2 แถวถูกกักกันไว้/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /ดาวน์โหลด failed_rows\.xlsx/ }));

    await waitFor(() => {
      expect(importReviewService.downloadFailedRows).toHaveBeenCalledWith(SESSION_ID);
    });
  });
});
