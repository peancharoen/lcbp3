// File: frontend/components/numbering/__tests__/metrics-dashboard.test.tsx
// Change Log:
// - 2026-06-13: Refactor to use static imports instead of require, fixing ESM module resolution errors
// - 2026-06-13: Fix fake timers and waitFor conflict to prevent test timeouts

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MetricsDashboard } from '../metrics-dashboard';
import { documentNumberingService } from '@/lib/services/document-numbering.service';

// Mock documentNumberingService
vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    getMetrics: vi.fn(),
  },
}));

describe('MetricsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    (documentNumberingService.getMetrics as any).mockImplementation(() => new Promise(() => {}));
    render(<MetricsDashboard />);
    expect(screen.getByText('Loading metrics...')).toBeInTheDocument();
  });

  it('should render metrics after successful fetch', async () => {
    const mockMetrics = {
      totalNumbers: 100,
      activeReservations: 5,
      audit: [],
      errors: [],
    };
    (documentNumberingService.getMetrics as any).mockResolvedValue(mockMetrics);
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Loading metrics...')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Generation Rate')).toBeInTheDocument();
    expect(screen.getByText('Sequence Utilization')).toBeInTheDocument();
    expect(screen.getByText('Lock Wait Time (P95)')).toBeInTheDocument();
    expect(screen.getByText('Recent Errors')).toBeInTheDocument();
  });

  it('should render no metrics message when fetch fails', async () => {
    (documentNumberingService.getMetrics as any).mockRejectedValue(new Error('API Error'));
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.queryByText('Loading metrics...')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No metrics available.')).toBeInTheDocument();
  });

  it('should display generation rate', async () => {
    (documentNumberingService.getMetrics as any).mockResolvedValue({});
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('120 /Hr')).toBeInTheDocument();
    });
  });

  it('should display sequence utilization', async () => {
    (documentNumberingService.getMetrics as any).mockResolvedValue({ audit: [] });
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  it('should display lock wait time', async () => {
    (documentNumberingService.getMetrics as any).mockResolvedValue({});
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('0.05s')).toBeInTheDocument();
    });
  });

  it('should display error count from metrics', async () => {
    const mockMetrics = {
      errors: [{ id: 1, message: 'Error 1' }, { id: 2, message: 'Error 2' }],
    };
    (documentNumberingService.getMetrics as any).mockResolvedValue(mockMetrics);
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('should display zero errors when metrics has no errors', async () => {
    (documentNumberingService.getMetrics as any).mockResolvedValue({});
    render(<MetricsDashboard />);
    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should poll metrics every 30 seconds', async () => {
    vi.useFakeTimers();
    (documentNumberingService.getMetrics as any).mockResolvedValue({});
    render(<MetricsDashboard />);
    await act(async () => {
      await vi.runAllTicks();
    });
    expect(documentNumberingService.getMetrics).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(documentNumberingService.getMetrics).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('should cleanup interval on unmount', async () => {
    vi.useFakeTimers();
    (documentNumberingService.getMetrics as any).mockResolvedValue({});
    const { unmount } = render(<MetricsDashboard />);
    await act(async () => {
      await vi.runAllTicks();
    });
    expect(documentNumberingService.getMetrics).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(documentNumberingService.getMetrics).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
