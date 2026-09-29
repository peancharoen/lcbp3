// File: frontend/app/(admin)/admin/notifications/settings/__tests__/page.test.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T058) — Telegram settings page test

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const mockSettings = vi.fn();
const mockPatchMutate = vi.fn();

vi.mock('@/hooks/use-notification-admin', () => ({
  useTelegramSettings: () => mockSettings(),
  usePatchTelegramSettings: () => ({ mutate: mockPatchMutate, isPending: false }),
}));

import NotificationSettingsPage from '../page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('NotificationSettingsPage (Feature 258 US4)', () => {
  it('renders masked bot status — no secret values', () => {
    mockSettings.mockReturnValue({
      data: {
        enabled: true,
        botTokenConfigured: true,
        webhookSecretConfigured: true,
        botUsername: 'lcbp3_bot',
        botReachable: true,
        botInfo: { username: 'lcbp3_bot' },
      },
      isLoading: false,
      isError: false,
    });
    render(<NotificationSettingsPage />);
    expect(screen.getAllByText(/@lcbp3_bot/).length).toBeGreaterThan(0);
    expect(screen.getByText('Enabled')).toBeTruthy();
  });

  it('toggle calls patch mutation with enabled flag', () => {
    mockSettings.mockReturnValue({
      data: {
        enabled: false,
        botTokenConfigured: true,
        webhookSecretConfigured: true,
        botUsername: 'lcbp3_bot',
        botReachable: true,
        botInfo: null,
      },
      isLoading: false,
      isError: false,
    });
    render(<NotificationSettingsPage />);
    fireEvent.click(screen.getByRole('switch'));
    expect(mockPatchMutate).toHaveBeenCalledWith({ enabled: true });
  });
});
