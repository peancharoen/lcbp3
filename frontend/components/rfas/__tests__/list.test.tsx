// File: frontend/components/rfas/__tests__/list.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for RFAList component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RFAList } from '../list';
import { RFA } from '@/types/rfa';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('RFAList', () => {
  const mockRFAs: RFA[] = [
    {
      publicId: '019505a1-7c3e-7000-8000-abc123def456',
      correspondence: {
        publicId: '019505a1-7c3e-7000-8000-abc123def457',
        correspondenceNumber: 'RFA-001',
        project: {
          publicId: '019505a1-7c3e-7000-8000-abc123def458',
          projectName: 'Test Project',
        },
        createdAt: '2026-01-01T00:00:00Z',
      },
      discipline: {
        publicId: '019505a1-7c3e-7000-8000-abc123def459',
        name: 'Structural',
      },
      revisions: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def460',
          subject: 'Test Subject 1',
          statusCode: {
            publicId: '019505a1-7c3e-7000-8000-abc123def461',
            statusName: 'Pending',
            statusCode: 'PENDING',
          },
          createdAt: '2026-01-01T00:00:00Z',
          items: [
            {
              shopDrawingRevision: {
                attachments: [
                  {
                    url: 'http://example.com/file.pdf',
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      publicId: '019505a1-7c3e-7000-8000-abc123def462',
      correspondence: {
        publicId: '019505a1-7c3e-7000-8000-abc123def463',
        correspondenceNumber: 'RFA-002',
        project: {
          publicId: '019505a1-7c3e-7000-8000-abc123def464',
          projectName: 'Another Project',
        },
        createdAt: '2026-01-02T00:00:00Z',
      },
      discipline: {
        publicId: '019505a1-7c3e-7000-8000-abc123def465',
        name: 'Architectural',
      },
      revisions: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def466',
          subject: 'Test Subject 2',
          statusCode: {
            publicId: '019505a1-7c3e-7000-8000-abc123def467',
            statusName: 'Approved',
            statusCode: 'APPROVED',
          },
          createdAt: '2026-01-02T00:00:00Z',
          items: [],
        },
      ],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render RFA list with data', () => {
    render(<RFAList data={mockRFAs} />);

    expect(screen.getByText('RFA-001')).toBeInTheDocument();
    expect(screen.getByText('RFA-002')).toBeInTheDocument();
    expect(screen.getByText('Test Subject 1')).toBeInTheDocument();
    expect(screen.getByText('Test Subject 2')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Another Project')).toBeInTheDocument();
    expect(screen.getByText('Structural')).toBeInTheDocument();
    expect(screen.getByText('Architectural')).toBeInTheDocument();
  });

  it('should render empty state when data is null', () => {
    const { container } = render(<RFAList data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render empty state when data is empty array', () => {
    render(<RFAList data={[]} />);

    // DataTable should render with empty data
    expect(screen.queryByText('RFA-001')).not.toBeInTheDocument();
  });

  it('should display formatted dates', () => {
    render(<RFAList data={mockRFAs} />);

    expect(screen.getByText('01 Jan 2026')).toBeInTheDocument();
    expect(screen.getByText('02 Jan 2026')).toBeInTheDocument();
  });

  it('should display status badges', () => {
    render(<RFAList data={mockRFAs} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('should render action buttons for each row', () => {
    render(<RFAList data={mockRFAs} />);

    // Should have view, file, and edit buttons for each row
    const viewButtons = screen.getAllByTitle('View Details');
    const fileButtons = screen.getAllByTitle('View File');
    const editButtons = screen.getAllByTitle('Edit');

    expect(viewButtons).toHaveLength(2);
    expect(fileButtons).toHaveLength(2);
    expect(editButtons).toHaveLength(2);
  });

  it('should handle missing project name', () => {
    const rfaWithoutProject: RFA[] = [
      {
        ...mockRFAs[0],
        correspondence: {
          ...mockRFAs[0].correspondence,
          project: undefined,
        },
      },
    ];

    render(<RFAList data={rfaWithoutProject} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing discipline name', () => {
    const rfaWithoutDiscipline: RFA[] = [
      {
        ...mockRFAs[0],
        discipline: undefined,
      },
    ];

    render(<RFAList data={rfaWithoutDiscipline} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing correspondence number', () => {
    const rfaWithoutNumber: RFA[] = [
      {
        ...mockRFAs[0],
        correspondence: {
          ...mockRFAs[0].correspondence,
          correspondenceNumber: undefined,
        },
      },
    ];

    render(<RFAList data={rfaWithoutNumber} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing subject', () => {
    const rfaWithoutSubject: RFA[] = [
      {
        ...mockRFAs[0],
        revisions: [
          {
            ...mockRFAs[0].revisions[0],
            subject: undefined,
          },
        ],
      },
    ];

    render(<RFAList data={rfaWithoutSubject} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing status', () => {
    const rfaWithoutStatus: RFA[] = [
      {
        ...mockRFAs[0],
        revisions: [
          {
            ...mockRFAs[0].revisions[0],
            statusCode: undefined,
          },
        ],
      },
    ];

    render(<RFAList data={rfaWithoutStatus} />);

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
