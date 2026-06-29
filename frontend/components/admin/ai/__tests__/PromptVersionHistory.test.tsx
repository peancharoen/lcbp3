// File: frontend/components/admin/ai/__tests__/PromptVersionHistory.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptVersionHistory from '../PromptVersionHistory';
import { AiPrompt } from '@/types/ai-prompts';

describe('PromptVersionHistory', () => {
  const mockVersions: AiPrompt[] = [
    {
      publicId: 'v1-id',
      versionNumber: 1,
      promptType: 'ocr_extraction',
      template: 'Template 1',
      isActive: false,
      createdAt: '2026-06-14T10:00:00Z',
      updatedAt: '2026-06-14T10:00:00Z',
      manualNote: 'Note 1',
    },
    {
      publicId: 'v2-id',
      versionNumber: 2,
      promptType: 'ocr_extraction',
      template: 'Template 2',
      isActive: true,
      createdAt: '2026-06-15T10:00:00Z',
      updatedAt: '2026-06-15T10:00:00Z',
      lastTestedAt: '2026-06-15T10:05:00Z',
    },
  ];

  const defaultProps = {
    versions: mockVersions,
    isLoading: false,
    onLoadTemplate: vi.fn(),
    onActivateVersion: vi.fn(),
    onDeleteVersion: vi.fn(),
    isActivating: false,
    isDeleting: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    render(<PromptVersionHistory {...defaultProps} isLoading={true} />);
    expect(screen.getByText(/กำลังโหลดประวัติเวอร์ชัน/)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<PromptVersionHistory {...defaultProps} versions={[]} />);
    expect(screen.getByText(/ไม่พบเวอร์ชันอื่นในระบบ/)).toBeInTheDocument();
  });

  it('renders versions correctly', () => {
    render(<PromptVersionHistory {...defaultProps} />);
    
    // Check version numbers
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    
    // Check active/inactive badges
    expect(screen.getByText(/ใช้งานจริง \(Active\)/)).toBeInTheDocument();
    expect(screen.getByText(/ร่าง \(Inactive\)/)).toBeInTheDocument();
    
    // Check manual note
    expect(screen.getByText('Note 1')).toBeInTheDocument();
  });

  it('calls action handlers when buttons are clicked', async () => {
    const user = userEvent.setup();
    render(<PromptVersionHistory {...defaultProps} />);
    
    // There are 2 load buttons
    const loadButtons = screen.getAllByRole('button', { name: /โหลด \(Load\)/ });
    expect(loadButtons).toHaveLength(2);
    
    await user.click(loadButtons[0]);
    expect(defaultProps.onLoadTemplate).toHaveBeenCalledWith(mockVersions[0]);

    // Active version should not have Activate/Delete buttons
    const activateButtons = screen.getAllByRole('button', { name: /ใช้งาน \(Activate\)/ });
    expect(activateButtons).toHaveLength(1); // Only for v1
    
    await user.click(activateButtons[0]);
    expect(defaultProps.onActivateVersion).toHaveBeenCalledWith(1);
    
    // Delete button (it uses an icon, but we can target by role 'button' and filter or use the trash icon if it had aria-label)
    // Actually, delete button is the 3rd button in the v1 row (Load, Activate, Delete)
    const deleteButton = screen.getAllByRole('button')[2]; // Load v1, Activate v1, Delete v1
    await user.click(deleteButton);
    expect(defaultProps.onDeleteVersion).toHaveBeenCalledWith(1);
  });
});
