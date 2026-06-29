// File: frontend/components/correspondences/circulation-status-card.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for circulation-status-card component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CirculationStatusCard } from './circulation-status-card';
import { useCirculationsByCorrespondence } from '@/hooks/use-circulation';

// Mock hook สำหรับ useCirculationsByCorrespondence
vi.mock('@/hooks/use-circulation', () => ({
  useCirculationsByCorrespondence: vi.fn(),
}));

describe('CirculationStatusCard Component', () => {
  const correspondencePublicId = '019505a1-7c3e-7000-8000-abc123def456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควรแสดง loading state เมื่อกำลังโหลดข้อมูล', () => {
    vi.mocked(useCirculationsByCorrespondence).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(<CirculationStatusCard correspondencePublicId={correspondencePublicId} />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('ควรแสดง empty state เมื่อไม่มีข้อมูล circulation', () => {
    vi.mocked(useCirculationsByCorrespondence).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(<CirculationStatusCard correspondencePublicId={correspondencePublicId} />);

    expect(screen.getByText('No circulations yet')).toBeInTheDocument();
    expect(screen.getByText('New Circulation')).toBeInTheDocument();
  });

  it('ควรแสดงรายการ circulation อย่างถูกต้องเมื่อโหลดสำเร็จ', () => {
    const mockData = [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123defaaa',
        circulationNo: 'CIRC-2026-001',
        subject: 'Circulation Subject A',
        statusCode: 'OPEN',
        routings: [
          {
            id: 1,
            status: 'COMPLETED',
            completedAt: '2026-06-13T00:00:00.000Z',
            assignee: {
              userId: 101,
              username: 'john_doe',
              firstName: 'John',
              lastName: 'Doe',
            },
          },
          {
            id: 2,
            status: 'PENDING',
            assignee: {
              userId: 102,
              username: 'jane_smith',
              firstName: 'Jane',
              lastName: 'Smith',
            },
          },
        ],
      },
    ];

    vi.mocked(useCirculationsByCorrespondence).mockReturnValue({
      data: mockData,
      isLoading: false,
    } as any);

    render(<CirculationStatusCard correspondencePublicId={correspondencePublicId} />);

    expect(screen.getByText('CIRC-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Circulation Subject A')).toBeInTheDocument();
    expect(screen.getByText('OPEN')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('13 Jun')).toBeInTheDocument();
  });

  it('ควรแสดงข้อความ +X more assignees เมื่อมีผู้รับมากกว่า 3 คน', () => {
    const mockData = [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123defbbb',
        circulationNo: 'CIRC-2026-002',
        subject: 'Circulation Subject B',
        statusCode: 'COMPLETED',
        routings: [
          { id: 1, status: 'COMPLETED', assignee: { username: 'u1' } },
          { id: 2, status: 'COMPLETED', assignee: { username: 'u2' } },
          { id: 3, status: 'COMPLETED', assignee: { username: 'u3' } },
          { id: 4, status: 'COMPLETED', assignee: { username: 'u4' } },
          { id: 5, status: 'PENDING', assignee: { username: 'u5' } },
        ],
      },
    ];

    vi.mocked(useCirculationsByCorrespondence).mockReturnValue({
      data: mockData,
      isLoading: false,
    } as any);

    render(<CirculationStatusCard correspondencePublicId={correspondencePublicId} />);

    expect(screen.getByText('+2 more assignees')).toBeInTheDocument();
  });
});
