// File: frontend/app/(admin)/admin/notifications/deliveries/__tests__/page.test.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T058) — deliveries admin page test

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockDeliveries = vi.fn();

vi.mock('@/hooks/use-notification-admin', () => ({
  useNotificationDeliveries: () => mockDeliveries(),
}));

vi.mock('@/components/common/data-table', () => ({
  DataTable: ({ data }: { data: unknown[] }) => <div data-testid="data-table">{JSON.stringify(data)}</div>,
}));

import NotificationDeliveriesPage from '../page';

const delivery = {
  publicId: 'd-1',
  channelType: 'TELEGRAM',
  target: '777888999',
  eventType: 'rfa.pending_approval',
  status: 'FAILED',
  errorCode: 'BOT_BLOCKED',
  errorMessage: 'Forbidden: bot was blocked by the user',
  attemptCount: 1,
  createdAt: '2026-09-25T08:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationDeliveriesPage (Feature 258 US4)', () => {
  it('renders delivery rows from the API', () => {
    mockDeliveries.mockReturnValue({
      data: { data: [delivery], meta: { total: 1, page: 1, limit: 50 } },
      isLoading: false,
      isError: false,
    });
    render(<NotificationDeliveriesPage />);
    const table = screen.getByTestId('data-table');
    expect(table.textContent).toContain('BOT_BLOCKED');
    expect(table.textContent).toContain('777888999');
  });

  it('shows error message when the query fails', () => {
    mockDeliveries.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
    });
    render(<NotificationDeliveriesPage />);
    expect(screen.getByText(/Failed to load deliveries|boom/)).toBeTruthy();
  });
});
