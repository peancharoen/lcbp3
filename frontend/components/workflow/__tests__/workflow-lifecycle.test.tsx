// File: frontend/components/workflow/__tests__/workflow-lifecycle.test.tsx
// Change Log
// - 2026-06-13: Add coverage for workflow timeline states, attachments, and upload handling.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { WorkflowLifecycle } from '../workflow-lifecycle';
import type { WorkflowHistoryItem } from '@/types/workflow';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

const history: WorkflowHistoryItem[] = [
  {
    id: 'step-submit',
    fromState: 'DRAFT',
    toState: 'IN_REVIEW',
    action: 'SUBMIT',
    actionByUserId: 7,
    comment: 'Ready for review',
    createdAt: '2026-06-13T08:00:00.000Z',
    attachments: [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123def901',
        originalFilename: 'submission.pdf',
      },
    ],
  },
  {
    id: 'step-approve',
    fromState: 'IN_REVIEW',
    toState: 'APPROVED',
    action: 'APPROVE',
    createdAt: '2026-06-13T09:00:00.000Z',
  },
];

describe('WorkflowLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        publicId: '019505a1-7c3e-7000-8000-abc123def902',
        originalFilename: 'uploaded.pdf',
      },
    });
  });

  it('renders loading, error, and empty states', () => {
    const { rerender } = render(<WorkflowLifecycle isLoading />);
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    rerender(<WorkflowLifecycle error={new Error('Load failed')} />);
    expect(screen.getByText('workflow.timeline.loadError')).toBeInTheDocument();
    rerender(<WorkflowLifecycle history={[]} />);
    expect(screen.getByText('workflow.timeline.noHistory')).toBeInTheDocument();
  });

  it('renders history steps and opens available attachments', async () => {
    const user = userEvent.setup();
    const onFileClick = vi.fn();
    render(<WorkflowLifecycle history={history} currentState="APPROVED" onFileClick={onFileClick} />);
    expect(screen.getByText('workflow.timeline.step.SUBMIT')).toBeInTheDocument();
    expect(screen.getByText('workflow.timeline.step.APPROVE')).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes('Ready for review'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /submission.pdf/i }));
    expect(onFileClick).toHaveBeenCalledWith(history[0].attachments?.[0]);
  });

  it('renders unavailable attachments as disabled chips', () => {
    render(
      <WorkflowLifecycle
        history={history}
        unavailableAttachmentIds={['019505a1-7c3e-7000-8000-abc123def901']}
      />
    );
    expect(screen.getByText('workflow.timeline.fileUnavailable')).toBeInTheDocument();
  });

  it('uploads and removes pending workflow step attachments', async () => {
    const onAttachmentsChange = vi.fn();
    render(<WorkflowLifecycle history={history} onAttachmentsChange={onAttachmentsChange} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'uploaded.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith('/files/upload', expect.any(FormData));
    });
    expect(onAttachmentsChange).toHaveBeenCalledWith(['019505a1-7c3e-7000-8000-abc123def902']);
    expect(screen.getByText('uploaded.pdf')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'workflow.timeline.removeFile' }));
    expect(onAttachmentsChange).toHaveBeenLastCalledWith([]);
  });

  it('shows upload error toast when a file upload fails', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Upload failed'));
    render(<WorkflowLifecycle history={history} onAttachmentsChange={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['bad'], 'bad.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('workflow.timeline.uploadError "bad.pdf"');
    });
  });
});
