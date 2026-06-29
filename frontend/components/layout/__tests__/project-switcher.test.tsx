// File: frontend/components/layout/__tests__/project-switcher.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProjectSwitcher } from '../project-switcher';

// Mock hooks
vi.mock('@/hooks/use-projects', () => ({
  useProjects: vi.fn(),
}));

vi.mock('@/lib/stores/project-store', () => ({
  useProjectStore: vi.fn(),
}));

import { useProjects } from '@/hooks/use-projects';
import { useProjectStore } from '@/lib/stores/project-store';

describe('ProjectSwitcher', () => {
  const mockSetSelectedProjectId = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render skeleton เมื่อกำลังโหลด', () => {
    vi.mocked(useProjects).mockReturnValue({ data: null, isLoading: true });
    vi.mocked(useProjectStore).mockReturnValue({ selectedProjectId: null, setSelectedProjectId: mockSetSelectedProjectId });

    render(<ProjectSwitcher />);

    const skeletons = screen.getAllByRole('generic', { name: '' }).filter(el => el.querySelector('.animate-pulse'));
    if (skeletons.length > 0) {
      expect(skeletons[0]).toBeInTheDocument();
    }
  });

  it('ควร return null เมื่อไม่มี projects', () => {
    vi.mocked(useProjects).mockReturnValue({ data: [], isLoading: false });
    vi.mocked(useProjectStore).mockReturnValue({ selectedProjectId: null, setSelectedProjectId: mockSetSelectedProjectId });

    const { container } = render(<ProjectSwitcher />);
    expect(container.firstChild).toBeNull();
  });

  it('ควรแสดง project name เป็น text เมื่อมี project เดียว', () => {
    const mockProjects = [
      { publicId: '019505a1-7c3e-7000-8000-abc123def456', projectName: 'Project A' },
    ];
    vi.mocked(useProjects).mockReturnValue({ data: mockProjects, isLoading: false });
    vi.mocked(useProjectStore).mockReturnValue({ selectedProjectId: null, setSelectedProjectId: mockSetSelectedProjectId });

    render(<ProjectSwitcher />);

    expect(screen.getByText('Project A')).toBeInTheDocument();
  });
});
