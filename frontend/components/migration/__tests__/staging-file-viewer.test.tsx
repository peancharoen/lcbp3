// File: frontend/components/migration/__tests__/staging-file-viewer.test.tsx
// Change Log:
// - 2026-08-25: Initial creation — regression test for iframe 401 bug
//   (raw iframe src → no Authorization header → backend 401)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import apiClient from '@/lib/api/client';
import { StagingFileViewer } from '../staging-file-viewer';

// Mock useTranslations — คืน stable function reference เพื่อป้องกัน useEffect infinite loop
const stableT = (key: string): string => key;
vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => stableT,
}));

// apiClient.get ถูก mock ใน vitest.setup.ts แล้ว
const mockApiGet = vi.mocked(apiClient.get);

// Mock URL.createObjectURL / revokeObjectURL
const mockObjectUrl = 'blob:http://localhost/mock-staging-url';
vi.stubGlobal('URL', {
  createObjectURL: vi.fn().mockReturnValue(mockObjectUrl),
  revokeObjectURL: vi.fn(),
});

describe('StagingFileViewer', () => {
  const mockBlob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiGet.mockResolvedValue({ data: mockBlob });
  });

  it('ดึงไฟล์ผ่าน apiClient พร้อม responseType: blob และส่ง path เป็น query param', async () => {
    const sourceFilePath = '/mnt/legacy-staging/Incoming/08C.2/2567/I672-0002-ผรม.2-คคง.-QC-0002.pdf';

    render(<StagingFileViewer sourceFilePath={sourceFilePath} />);

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith(
        '/migration/staging-file',
        expect.objectContaining({
          responseType: 'blob',
          params: { path: sourceFilePath },
        })
      );
    });
  });

  it('เซ็ต iframe src เป็น blob: URL (ไม่ใช่ raw /api/... URL) เพื่อหลีกเลี่ยง 401', async () => {
    const sourceFilePath = '/mnt/legacy-staging/test.pdf';

    render(<StagingFileViewer sourceFilePath={sourceFilePath} />);

    const iframe = (await waitFor(() =>
      screen.getByTitle('Document Viewer')
    )) as HTMLIFrameElement;

    expect(iframe.tagName).toBe('IFRAME');
    // สำคัญ: src ต้องเป็น blob: URL ไม่ใช่ raw /api/migration/staging-file?...
    expect(iframe.src).toContain('blob:');
    expect(iframe.src).not.toContain('/api/migration/staging-file');
  });

  it('แสดง empty state เมื่อ sourceFilePath เป็น null', () => {
    const { container } = render(<StagingFileViewer sourceFilePath={null} />);

    expect(screen.getByText('No Source File Path found for this document')).toBeInTheDocument();
    // ต้องไม่เรียก API เลย
    expect(mockApiGet).not.toHaveBeenCalled();
    // ต้องไม่มี iframe
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('แสดง error message เมื่อ API ตอบ 404', async () => {
    mockApiGet.mockRejectedValueOnce({
      response: { status: 404 },
    });

    render(<StagingFileViewer sourceFilePath="/missing.pdf" />);

    await waitFor(() => {
      expect(screen.getByText('filePreview.fileUnavailable')).toBeInTheDocument();
    });
  });

  it('revoke BlobURL เมื่อ component unmount เพื่อป้องกัน memory leak', async () => {
    const { unmount } = render(<StagingFileViewer sourceFilePath="/test.pdf" />);

    await waitFor(() => {
      expect(screen.getByTitle('Document Viewer')).toBeInTheDocument();
    });

    unmount();

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
  });
});
