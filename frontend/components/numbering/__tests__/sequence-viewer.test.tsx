// File: frontend/components/numbering/__tests__/sequence-viewer.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for SequenceViewer component
// - 2026-06-13: Refactor to use static ESM imports instead of CommonJS require() to resolve Vitest module path errors
// - 2026-06-13: Use regex queries for robust text matching and getAllByText for duplicate years

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SequenceViewer } from '../sequence-viewer';
import { numberingApi } from '@/lib/api/numbering';

// Mock numberingApi
vi.mock('@/lib/api/numbering', () => ({
  numberingApi: {
    getSequences: vi.fn(),
  },
}));

describe('SequenceViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    vi.mocked(numberingApi.getSequences).mockImplementation(() => new Promise(() => {}));
    render(<SequenceViewer />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('should render sequences after successful fetch', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 1,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Year\s*2026/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Project:\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Type:\s*1/)).toBeInTheDocument();
    expect(screen.getByText(/Counter:\s*100/)).toBeInTheDocument();
  });

  it('should handle wrapped response with data property', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue({ data: mockSequences } as any);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Year\s*2026/)).toBeInTheDocument();
    });
  });

  it('should show empty state when no sequences found', async () => {
    vi.mocked(numberingApi.getSequences).mockResolvedValue([]);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText('No sequences found')).toBeInTheDocument();
    });
  });

  it('should show empty state when fetch fails', async () => {
    vi.mocked(numberingApi.getSequences).mockRejectedValue(new Error('API Error'));
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText('No sequences found')).toBeInTheDocument();
    });
  });

  it('should filter sequences by year', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
      {
        projectId: 1,
        typeId: 1,
        year: 2025,
        lastNumber: 50,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Year\s*2026/)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText('Search by year, project, type...');
    fireEvent.change(searchInput, { target: { value: '2026' } });
    expect(screen.getByText(/Year\s*2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Year\s*2025/)).not.toBeInTheDocument();
  });

  it('should filter sequences by project', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 3,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
      {
        projectId: 2,
        typeId: 4,
        year: 2026,
        lastNumber: 50,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getAllByText(/Year\s*2026/).length).toBe(2);
    });
    const searchInput = screen.getByPlaceholderText('Search by year, project, type...');
    fireEvent.change(searchInput, { target: { value: '1' } });
    expect(screen.getByText(/Project:\s*1/)).toBeInTheDocument();
    expect(screen.queryByText(/Project:\s*2/)).not.toBeInTheDocument();
  });

  it('should filter sequences by type', async () => {
    const mockSequences = [
      {
        projectId: 3,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
      {
        projectId: 3,
        typeId: 2,
        year: 2026,
        lastNumber: 50,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getAllByText(/Year\s*2026/).length).toBe(2);
    });
    const searchInput = screen.getByPlaceholderText('Search by year, project, type...');
    fireEvent.change(searchInput, { target: { value: '1' } });
    expect(screen.getByText(/Type:\s*1/)).toBeInTheDocument();
    expect(screen.queryByText(/Type:\s*2/)).not.toBeInTheDocument();
  });

  it('should display discipline badge when disciplineId > 0', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 1,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Disc:\s*1/)).toBeInTheDocument();
    });
  });

  it('should display All for recipientOrganizationId -1', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: -1,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Recipient:\s*All/)).toBeInTheDocument();
    });
  });

  it('should display specific recipient organization', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(screen.getByText(/Recipient:\s*2/)).toBeInTheDocument();
    });
  });

  it('should refresh sequences when refresh button clicked', async () => {
    const mockSequences = [
      {
        projectId: 1,
        typeId: 1,
        year: 2026,
        lastNumber: 100,
        originatorId: 1,
        recipientOrganizationId: 2,
        disciplineId: 0,
      },
    ];
    vi.mocked(numberingApi.getSequences).mockResolvedValue(mockSequences);
    render(<SequenceViewer />);
    await waitFor(() => {
      expect(numberingApi.getSequences).toHaveBeenCalledTimes(1);
    });
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    await waitFor(() => {
      expect(numberingApi.getSequences).toHaveBeenCalledTimes(2);
    });
  });

  it('should disable refresh button while loading', async () => {
    vi.mocked(numberingApi.getSequences).mockImplementation(() => new Promise(() => {}));
    render(<SequenceViewer />);
    const refreshButton = screen.getByText('Refresh');
    expect(refreshButton).toBeDisabled();
  });
});
