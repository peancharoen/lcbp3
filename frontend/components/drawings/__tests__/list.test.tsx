// File: frontend/components/drawings/__tests__/list.test.tsx
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawingList } from '../list';
import { useDrawings } from '@/hooks/use-drawing';

// Mock useDrawings hook
vi.mock('@/hooks/use-drawing', () => ({
  useDrawings: vi.fn(),
}));

// Mock ServerDataTable
vi.mock('@/components/documents/common/server-data-table', () => ({
  ServerDataTable: ({ isLoading, data }: { isLoading: boolean; data: unknown[] }) => (
    <div>
      {isLoading ? <div>Loading...</div> : <div>{data.length} items</div>}
    </div>
  ),
}));

describe('DrawingList', () => {
  const mockProjectUuid = '019505a1-7c3e-7000-8000-abc123def456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state', () => {
    (useDrawings as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });
    render(<DrawingList type="SHOP" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render drawings data', () => {
    (useDrawings as any).mockReturnValue({
      data: {
        data: [{ publicId: 'uuid-1', drawingNumber: 'SD-001' }],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<DrawingList type="SHOP" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('1 items')).toBeInTheDocument();
  });

  it('should render error state', () => {
    (useDrawings as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        response: {
          status: 500,
          data: { message: 'Server error' },
        },
      },
    });
    render(<DrawingList type="SHOP" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('Failed to load shop drawings')).toBeInTheDocument();
    expect(screen.getByText('HTTP 500: Server error')).toBeInTheDocument();
  });

  it('should render error with array message', () => {
    (useDrawings as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        response: {
          status: 400,
          data: { message: ['Error 1', 'Error 2'] },
        },
      },
    });
    render(<DrawingList type="CONTRACT" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('Failed to load contract drawings')).toBeInTheDocument();
    expect(screen.getByText(/Error 1, Error 2/)).toBeInTheDocument();
  });

  it('should render error with generic message', () => {
    (useDrawings as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: {
        message: 'Network error',
      },
    });
    render(<DrawingList type="AS_BUILT" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('Failed to load as_built drawings')).toBeInTheDocument();
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('should handle empty data', () => {
    (useDrawings as any).mockReturnValue({
      data: {
        data: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
      },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<DrawingList type="SHOP" projectUuid={mockProjectUuid} />);
    expect(screen.getByText('0 items')).toBeInTheDocument();
  });

  it('should pass filters to useDrawings', () => {
    (useDrawings as any).mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(
      <DrawingList
        type="SHOP"
        projectUuid={mockProjectUuid}
        filters={{ search: 'test' }}
      />
    );
    expect(useDrawings).toHaveBeenCalledWith('SHOP', {
      projectUuid: mockProjectUuid,
      search: 'test',
      page: 1,
      limit: 20,
    });
  });

  it('should handle CONTRACT type', () => {
    (useDrawings as any).mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<DrawingList type="CONTRACT" projectUuid={mockProjectUuid} />);
    expect(useDrawings).toHaveBeenCalledWith('CONTRACT', expect.any(Object));
  });

  it('should handle AS_BUILT type', () => {
    (useDrawings as any).mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<DrawingList type="AS_BUILT" projectUuid={mockProjectUuid} />);
    expect(useDrawings).toHaveBeenCalledWith('AS_BUILT', expect.any(Object));
  });
});
