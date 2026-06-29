// File: frontend/components/workflow/__tests__/integrated-banner.test.tsx
// Change Log
// - 2026-06-13: Add coverage for IntegratedBanner legacy and workflow action modes.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegratedBanner } from '../integrated-banner';
import { useWorkflowAction } from '@/hooks/use-workflow-action';

const mutate = vi.fn();

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/hooks/use-workflow-action', () => ({
  useWorkflowAction: vi.fn(),
}));

describe('IntegratedBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useWorkflowAction).mockReturnValue({
      mutate,
      isPending: false,
    } as ReturnType<typeof useWorkflowAction>);
  });

  it('renders metadata, priority, workflow state, and legacy actions', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntegratedBanner
        docNo="RFA-001"
        subject="Pump room approval"
        status="IN_REVIEW"
        priority="HIGH"
        workflowState="PENDING_REVIEW"
        availableActions={['APPROVE']}
        onAction={onAction}
      />
    );
    expect(screen.getByText('RFA-001')).toBeInTheDocument();
    expect(screen.getByText('Pump room approval')).toBeInTheDocument();
    expect(screen.getByText('workflow.priority.HIGH')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /workflow.action.APPROVE/i }));
    expect(onAction).toHaveBeenCalledWith('APPROVE', undefined);
  });

  it('requires comment for reject action', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <IntegratedBanner
        docNo="RFA-002"
        subject="Return with note"
        status="REJECTED"
        availableActions={['REJECT']}
        onAction={onAction}
      />
    );
    await user.click(screen.getByRole('button', { name: /workflow.action.REJECT/i }));
    await user.type(screen.getByPlaceholderText('workflow.action.commentPlaceholder'), 'Need correction');
    await user.click(screen.getByRole('button', { name: 'workflow.action.confirm' }));
    expect(onAction).toHaveBeenCalledWith('REJECT', 'Need correction');
  });

  it('uses workflow mutation when instanceId is provided', async () => {
    const user = userEvent.setup();
    const onActionSuccess = vi.fn();
    render(
      <IntegratedBanner
        docNo="RFA-003"
        subject="Approve with instance"
        status="APPROVED"
        instanceId="019505a1-7c3e-7000-8000-abc123def801"
        pendingAttachmentIds={['019505a1-7c3e-7000-8000-abc123def802']}
        availableActions={['APPROVE']}
        onActionSuccess={onActionSuccess}
      />
    );
    await user.click(screen.getByRole('button', { name: /workflow.action.APPROVE/i }));
    expect(mutate).toHaveBeenCalledWith(
      {
        action: 'APPROVE',
        comment: undefined,
        attachmentPublicIds: ['019505a1-7c3e-7000-8000-abc123def802'],
      },
      { onSuccess: onActionSuccess }
    );
  });
});
