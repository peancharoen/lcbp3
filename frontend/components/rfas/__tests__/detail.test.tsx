// File: frontend/components/rfas/__tests__/detail.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for RFADetail component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RFADetail } from '../detail';
import { RFA } from '@/types/rfa';

// Mock dependencies
vi.mock('@/hooks/use-rfa', () => ({
  useProcessRFA: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  useSubmitRFA: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/components/review-team/ReviewTeamSelector', () => ({
  ReviewTeamSelector: () => <div data-testid="review-team-selector">Review Team Selector</div>,
}));

describe('RFADetail', () => {
  const mockRFA: RFA = {
    publicId: '019505a1-7c3e-7000-8000-abc123def456',
    correspondence: {
      publicId: '019505a1-7c3e-7000-8000-abc123def457',
      correspondenceNumber: 'RFA-001',
      project: {
        publicId: '019505a1-7c3e-7000-8000-abc123def458',
        projectName: 'Test Project',
      },
      discipline: {
        publicId: '019505a1-7c3e-7000-8000-abc123def459',
        codeNameEn: 'Structural',
        codeNameTh: 'โครงสร้าง',
        disciplineCode: 'STR',
      },
      createdAt: '2026-01-01T00:00:00Z',
    },
    discipline: {
      publicId: '019505a1-7c3e-7000-8000-abc123def460',
      name: 'Structural',
    },
    revisions: [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123def461',
        isCurrent: true,
        subject: 'Test Subject',
        description: 'Test Description',
        statusCode: {
          publicId: '019505a1-7c3e-7000-8000-abc123def462',
          statusName: 'Draft',
          statusCode: 'DFT',
        },
        createdAt: '2026-01-01T00:00:00Z',
        items: [
          {
            id: 1,
            itemType: 'SHOP_DRAWING',
            shopDrawingRevision: {
              shopDrawing: {
                drawingNumber: 'SD-001',
              },
              revisionLabel: 'A',
              title: 'Test Drawing',
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render RFA detail with data', () => {
    render(<RFADetail data={mockRFA} />);

    expect(screen.getByText('RFA-001')).toBeInTheDocument();
    expect(screen.getByText('Test Subject')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('Structural')).toBeInTheDocument();
  });

  it('should display created date', () => {
    render(<RFADetail data={mockRFA} />);

    expect(screen.getByText(/Created on/)).toBeInTheDocument();
  });

  it('should display status badge', () => {
    render(<RFADetail data={mockRFA} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('should show Edit and Submit buttons for DFT status', () => {
    render(<RFADetail data={mockRFA} />);

    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('Submit RFA')).toBeInTheDocument();
  });

  it('should show Approve and Reject buttons for FAP status', () => {
    const fapRFA: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          statusCode: {
            ...mockRFA.revisions[0].statusCode,
            statusName: 'For Approval',
            statusCode: 'FAP',
          },
        },
      ],
    };

    render(<RFADetail data={fapRFA} />);

    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('should show Approve and Reject buttons for FRE status', () => {
    const freRFA: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          statusCode: {
            ...mockRFA.revisions[0].statusCode,
            statusName: 'For Review',
            statusCode: 'FRE',
          },
        },
      ],
    };

    render(<RFADetail data={freRFA} />);

    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
  });

  it('should render RFA items table', () => {
    render(<RFADetail data={mockRFA} />);

    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Drawing No.')).toBeInTheDocument();
    expect(screen.getByText('Revision')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('SHOP_DRAWING')).toBeInTheDocument();
    expect(screen.getByText('SD-001')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Test Drawing')).toBeInTheDocument();
  });

  it('should show empty state when no items', () => {
    const rfaWithoutItems: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          items: [],
        },
      ],
    };

    render(<RFADetail data={rfaWithoutItems} />);

    expect(screen.getByText('No drawing items linked to this RFA.')).toBeInTheDocument();
  });

  it('should handle missing project name', () => {
    const rfaWithoutProject: RFA = {
      ...mockRFA,
      correspondence: {
        ...mockRFA.correspondence,
        project: undefined,
      },
    };

    render(<RFADetail data={rfaWithoutProject} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing discipline', () => {
    const rfaWithoutDiscipline: RFA = {
      ...mockRFA,
      correspondence: {
        ...mockRFA.correspondence,
        discipline: undefined,
      },
    };

    render(<RFADetail data={rfaWithoutDiscipline} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should handle missing subject', () => {
    const rfaWithoutSubject: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          subject: undefined,
        },
      ],
    };

    render(<RFADetail data={rfaWithoutSubject} />);

    expect(screen.getByText('Untitled RFA')).toBeInTheDocument();
  });

  it('should handle missing description', () => {
    const rfaWithoutDescription: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          description: undefined,
        },
      ],
    };

    render(<RFADetail data={rfaWithoutDescription} />);

    expect(screen.getByText('No description provided.')).toBeInTheDocument();
  });

  it('should open submit dialog when Submit RFA clicked', () => {
    render(<RFADetail data={mockRFA} />);

    const submitButton = screen.getByText('Submit RFA');
    fireEvent.click(submitButton);

    expect(screen.getByText('Submit RFA to Workflow')).toBeInTheDocument();
  });

  it('should show review team selector when project has publicId', () => {
    render(<RFADetail data={mockRFA} />);

    const submitButton = screen.getByText('Submit RFA');
    fireEvent.click(submitButton);

    expect(screen.getByTestId('review-team-selector')).toBeInTheDocument();
  });

  it('should close submit dialog when Cancel clicked', () => {
    render(<RFADetail data={mockRFA} />);

    const submitButton = screen.getByText('Submit RFA');
    fireEvent.click(submitButton);

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(screen.queryByText('Submit RFA to Workflow')).not.toBeInTheDocument();
  });

  it('should open approve dialog when Approve clicked', () => {
    const fapRFA: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          statusCode: {
            ...mockRFA.revisions[0].statusCode,
            statusCode: 'FAP',
          },
        },
      ],
    };

    render(<RFADetail data={fapRFA} />);

    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    expect(screen.getByText('Confirm Approval')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('should open reject dialog when Reject clicked', () => {
    const fapRFA: RFA = {
      ...mockRFA,
      revisions: [
        {
          ...mockRFA.revisions[0],
          statusCode: {
            ...mockRFA.revisions[0].statusCode,
            statusCode: 'FAP',
          },
        },
      ],
    };

    render(<RFADetail data={fapRFA} />);

    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    expect(screen.getByText('Confirm Rejection')).toBeInTheDocument();
    expect(screen.getByText('Comments')).toBeInTheDocument();
  });

  it('should handle missing correspondence number', () => {
    const rfaWithoutNumber: RFA = {
      ...mockRFA,
      correspondence: {
        ...mockRFA.correspondence,
        correspondenceNumber: undefined,
      },
    };

    render(<RFADetail data={rfaWithoutNumber} />);

    expect(screen.getByText('RFA')).toBeInTheDocument();
  });

  it('should use fallback discipline codes', () => {
    const rfaWithDisciplineCodes: RFA = {
      ...mockRFA,
      correspondence: {
        ...mockRFA.correspondence,
        discipline: {
          publicId: '019505a1-7c3e-7000-8000-abc123def460',
          codeNameEn: undefined,
          codeNameTh: undefined,
          disciplineCode: 'STR',
        },
      },
    };

    render(<RFADetail data={rfaWithDisciplineCodes} />);

    expect(screen.getByText('STR')).toBeInTheDocument();
  });
});
