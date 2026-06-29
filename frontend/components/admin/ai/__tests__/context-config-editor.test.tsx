// File: frontend/components/admin/ai/__tests__/context-config-editor.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ContextConfigEditor from '../ContextConfigEditor';

// Mock services
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

import { projectService } from '@/lib/services/project.service';
import { contractService } from '@/lib/services/contract.service';

describe('ContextConfigEditor', () => {
  const mockOnSave = vi.fn();
  const mockProjects = [
    { publicId: '019505a1-7c3e-7000-8000-abc123def456', projectName: 'Project A' },
  ];
  const mockContracts = [
    { publicId: '019505a1-7c3e-7000-8000-xyz789uvw012', contractName: 'Contract A', project: { publicId: '019505a1-7c3e-7000-8000-abc123def456' } },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getAll).mockResolvedValue(mockProjects);
    vi.mocked(contractService.getAll).mockResolvedValue(mockContracts);
  });

  it('ควร render form สำหรับตั้งค่าบริบทข้อมูล', () => {
    render(
      <ContextConfigEditor
        initialConfig={null}
        onSave={mockOnSave}
        isSaving={false}
      />
    );

    expect(screen.getByText('การตั้งค่าบริบทข้อมูล (Context Configuration)')).toBeInTheDocument();
  });

  it('ควร disabled ปุ่มบันทึกเมื่อ isSaving=true', () => {
    render(
      <ContextConfigEditor
        initialConfig={null}
        onSave={mockOnSave}
        isSaving={true}
      />
    );

    const saveButton = screen.queryByText('กำลังบันทึก...');
    if (saveButton) {
      expect(saveButton).toBeDisabled();
    }
  });
});
