// File: frontend/components/admin/ai/__tests__/ContextConfigEditor.test.tsx
// Change Log:
// - 2026-06-15: Created test file for ContextConfigEditor

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ContextConfigEditor from '../ContextConfigEditor';
import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';

// Mock the external services
vi.mock('@/lib/services/project.service', () => ({
  projectService: {
    getAll: vi.fn(),
  },
}));

vi.mock('@/lib/services/contract.service', () => ({
  contractService: {
    getAll: vi.fn(),
  },
}));

// Mock i18n
vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

const mockProjects = [
  { publicId: 'proj-1', projectName: 'Project 1' },
  { publicId: 'proj-2', projectName: 'Project 2' },
];

const mockContracts = [
  { publicId: 'contract-1', contractName: 'Contract 1', project: { publicId: 'proj-1' } },
  { publicId: 'contract-2', contractName: 'Contract 2', project: { publicId: 'proj-1' } },
  { publicId: 'contract-3', contractName: 'Contract 3', project: { publicId: 'proj-2' } },
];

describe('ContextConfigEditor', () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (projectService.getAll as any).mockResolvedValue(mockProjects);
    (contractService.getAll as any).mockResolvedValue(mockContracts);
  });

  it('renders correctly with default values when initialConfig is null', async () => {
    render(<ContextConfigEditor initialConfig={null} onSave={mockOnSave} isSaving={false} />);

    // Wait for services to load
    await waitFor(() => {
      expect(projectService.getAll).toHaveBeenCalled();
      expect(contractService.getAll).toHaveBeenCalled();
    });

    expect(screen.getByText('การตั้งค่าบริบทข้อมูล (Context Configuration)')).toBeInTheDocument();

    // Check default input value
    const pageSizeInput = screen.getByRole('spinbutton');
    expect(pageSizeInput).toHaveValue(3);
  });

  it('calls onSave with valid data', async () => {
    const user = userEvent.setup();
    render(<ContextConfigEditor initialConfig={null} onSave={mockOnSave} isSaving={false} />);

    await waitFor(() => {
      expect(projectService.getAll).toHaveBeenCalled();
    });

    const saveButton = screen.getByRole('button', { name: /บันทึกบริบท/i });
    await user.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledWith({
      filter: {
        projectId: null,
        contractId: null,
      },
      pageSize: 3,
      language: 'th',
      outputLanguage: 'th',
    });
  });

  it('validates pageSize input', async () => {
    const user = userEvent.setup();
    render(<ContextConfigEditor initialConfig={null} onSave={mockOnSave} isSaving={false} />);

    const pageSizeInput = screen.getByRole('spinbutton');

    // Set invalid value
    await user.clear(pageSizeInput);
    await user.type(pageSizeInput, '2000');

    const saveButton = screen.getByRole('button', { name: /บันทึกบริบท/i });
    await user.click(saveButton);

    expect(mockOnSave).not.toHaveBeenCalled();
    expect(screen.getByText('prompt_management.pageSize_invalid')).toBeInTheDocument();
  });

  it('displays saving state', () => {
    render(<ContextConfigEditor initialConfig={null} onSave={mockOnSave} isSaving={true} />);
    expect(screen.getByRole('button', { name: /กำลังบันทึก/i })).toBeDisabled();
  });
});
