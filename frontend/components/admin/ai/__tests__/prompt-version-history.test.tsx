// File: frontend/components/admin/ai/__tests__/prompt-version-history.test.tsx
// Change Log
// - 2026-06-13: Add coverage for prompt version history rendering and actions.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import PromptVersionHistory from '../PromptVersionHistory';
import type { AiPrompt } from '@/types/ai-prompts';

const versions: AiPrompt[] = [
  {
    publicId: '019505a1-7c3e-7000-8000-abc123defa01',
    promptType: 'metadata_extraction',
    versionNumber: 3,
    template: 'active prompt',
    isActive: true,
    createdAt: '2026-06-13T08:00:00.000Z',
    lastTestedAt: '2026-06-13T09:00:00.000Z',
    manualNote: 'ผ่านการทดสอบกับ RFA แล้ว',
  },
  {
    publicId: '019505a1-7c3e-7000-8000-abc123defa02',
    promptType: 'metadata_extraction',
    versionNumber: 2,
    template: 'draft prompt',
    isActive: false,
    createdAt: '2026-06-12T08:00:00.000Z',
  },
];

describe('PromptVersionHistory', () => {
  it('renders loading and empty states', () => {
    const callbacks = {
      onLoadTemplate: vi.fn(),
      onActivateVersion: vi.fn(),
      onDeleteVersion: vi.fn(),
    };
    const { rerender } = render(
      <PromptVersionHistory versions={[]} isLoading {...callbacks} isActivating={false} isDeleting={false} />
    );
    expect(screen.getByText('กำลังโหลดประวัติเวอร์ชัน...')).toBeInTheDocument();
    rerender(<PromptVersionHistory versions={[]} isLoading={false} {...callbacks} isActivating={false} isDeleting={false} />);
    expect(screen.getByText('ไม่พบเวอร์ชันอื่นในระบบ')).toBeInTheDocument();
  });

  it('renders versions and triggers version actions', async () => {
    const user = userEvent.setup();
    const onLoadTemplate = vi.fn();
    const onActivateVersion = vi.fn();
    const onDeleteVersion = vi.fn();
    render(
      <PromptVersionHistory
        versions={versions}
        isLoading={false}
        onLoadTemplate={onLoadTemplate}
        onActivateVersion={onActivateVersion}
        onDeleteVersion={onDeleteVersion}
        isActivating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText('v3')).toBeInTheDocument();
    expect(screen.getByText('ใช้งานจริง (Active)')).toBeInTheDocument();
    expect(screen.getByText('ผ่านการทดสอบกับ RFA แล้ว')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'โหลด (Load)' })[1]);
    await user.click(screen.getByRole('button', { name: 'ใช้งาน (Activate)' }));
    await user.click(screen.getByRole('button', { name: '' }));
    expect(onLoadTemplate).toHaveBeenCalledWith(versions[1]);
    expect(onActivateVersion).toHaveBeenCalledWith(2);
    expect(onDeleteVersion).toHaveBeenCalledWith(2);
  });
});
