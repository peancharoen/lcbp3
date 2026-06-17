// File: frontend/components/admin/ai/__tests__/VersionHistory.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import VersionHistory from '../VersionHistory';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('VersionHistory', () => {
  const mockOnLoadTemplate = vi.fn();
  const mockOnActivateVersion = vi.fn();
  const mockOnDeleteVersion = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const generateVersions = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      versionNumber: i + 1,
      promptType: 'ocr_extraction',
      promptText: 'prompt text',
      createdAt: new Date().toISOString(),
      isActive: i === 0,
      manualNote: `Note ${i + 1}`,
      authorName: 'Admin',
    }));
  };

  it('renders loading state', () => {
    render(
      <VersionHistory
        versions={[]}
        isLoading={true}
        onLoadTemplate={mockOnLoadTemplate}
        onActivateVersion={mockOnActivateVersion}
        onDeleteVersion={mockOnDeleteVersion}
        isActivating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText(/prompt_management.version_history/i)).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(
      <VersionHistory
        versions={[]}
        isLoading={false}
        onLoadTemplate={mockOnLoadTemplate}
        onActivateVersion={mockOnActivateVersion}
        onDeleteVersion={mockOnDeleteVersion}
        isActivating={false}
        isDeleting={false}
      />
    );
    expect(screen.getByText('prompt_management.no_versions')).toBeInTheDocument();
  });

  it('renders versions', () => {
    const versions = generateVersions(2);
    render(
      <VersionHistory
        versions={versions}
        isLoading={false}
        onLoadTemplate={mockOnLoadTemplate}
        onActivateVersion={mockOnActivateVersion}
        onDeleteVersion={mockOnDeleteVersion}
        isActivating={false}
        isDeleting={false}
      />
    );
    
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();
    expect(screen.getByText('Note 1')).toBeInTheDocument();
    expect(screen.getByText('prompt_management.is_active')).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    const user = userEvent.setup();
    const versions = generateVersions(25); // Page size is 20
    
    render(
      <VersionHistory
        versions={versions}
        isLoading={false}
        onLoadTemplate={mockOnLoadTemplate}
        onActivateVersion={mockOnActivateVersion}
        onDeleteVersion={mockOnDeleteVersion}
        isActivating={false}
        isDeleting={false}
      />
    );
    
    // Page 1 should have v1 to v20
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v20')).toBeInTheDocument();
    expect(screen.queryByText('v21')).not.toBeInTheDocument();

    // Next page button is the right chevron
    const nextBtn = document.querySelector('button .lucide-chevron-right')?.closest('button');
    if (nextBtn) {
      await user.click(nextBtn);
    }

    // Page 2 should have v21 to v25
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
    expect(screen.getByText('v21')).toBeInTheDocument();
    expect(screen.getByText('v25')).toBeInTheDocument();
  });
});
