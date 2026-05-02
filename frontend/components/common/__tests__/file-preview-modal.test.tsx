// T043: Vitest component test for FilePreviewModal
// ตรวจสอบ: PDF → iframe, Image → img, unsupported → download link, onClose callback

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import apiClient from '@/lib/api/client';
import { FilePreviewModal } from '../file-preview-modal';
import type { WorkflowAttachmentSummary } from '@/types/workflow';

// Mock useTranslations — คืน key เป็น fallback สำหรับ test
vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

// apiClient.get ถูก mock ใน vitest.setup.ts แล้ว
const mockApiGet = vi.mocked(apiClient.get);

// Mock URL.createObjectURL / revokeObjectURL
const mockObjectUrl = 'blob:http://localhost/mock-blob-url';
vi.stubGlobal('URL', {
  createObjectURL: vi.fn().mockReturnValue(mockObjectUrl),
  revokeObjectURL: vi.fn(),
});

const makeAttachment = (
  overrides: Partial<WorkflowAttachmentSummary> = {}
): WorkflowAttachmentSummary => ({
  publicId: 'att-preview-001',
  originalFilename: 'test-file.pdf',
  mimeType: 'application/pdf',
  fileSize: 102400,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('FilePreviewModal', () => {
  const onClose = vi.fn();
  const onUnavailable = vi.fn();
  const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: mockBlob });
  });

  it('renders iframe for PDF MIME type', async () => {
    const attachment = makeAttachment({ mimeType: 'application/pdf' });

    render(<FilePreviewModal attachment={attachment} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByTitle('test-file.pdf')).toBeInTheDocument();
    });

    const iframe = screen.getByTitle('test-file.pdf') as HTMLIFrameElement;
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe.src).toContain('blob:');
  });

  it('renders img for image MIME type', async () => {
    const imageBlob = new Blob(['fake-image'], { type: 'image/png' });
    mockApiGet.mockResolvedValue({ data: imageBlob });

    const attachment = makeAttachment({
      mimeType: 'image/png',
      originalFilename: 'photo.png',
    });

    render(<FilePreviewModal attachment={attachment} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByAltText('photo.png')).toBeInTheDocument();
    });

    const img = screen.getByAltText('photo.png') as HTMLImageElement;
    expect(img.tagName).toBe('IMG');
  });

  it('shows download link for unsupported MIME type (no iframe or img)', async () => {
    const docxBlob = new Blob(['PK...'], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    mockApiGet.mockResolvedValue({ data: docxBlob });

    const attachment = makeAttachment({
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      originalFilename: 'report.docx',
    });

    render(<FilePreviewModal attachment={attachment} onClose={onClose} />);

    await waitFor(() => {
      // download link ต้องมี href = blobUrl
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', mockObjectUrl);
      expect(link).toHaveAttribute('download', 'report.docx');
    });

    // ต้องไม่มี iframe หรือ img
    expect(screen.queryByTitle('report.docx')).not.toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const attachment = makeAttachment();

    render(<FilePreviewModal attachment={attachment} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /filepreview.close/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /filepreview.close/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onUnavailable when API returns 404', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), {
      response: { status: 404 },
    });
    mockApiGet.mockRejectedValue(notFoundError);

    const attachment = makeAttachment({ publicId: 'missing-att-001' });

    render(
      <FilePreviewModal
        attachment={attachment}
        onClose={onClose}
        onUnavailable={onUnavailable}
      />
    );

    await waitFor(() => {
      expect(onUnavailable).toHaveBeenCalledWith('missing-att-001');
    });
  });

  it('does not render when attachment is null (dialog closed)', () => {
    render(<FilePreviewModal attachment={null} onClose={onClose} />);

    // Dialog should not be visible
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
