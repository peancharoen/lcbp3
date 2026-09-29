// File: frontend/app/(admin)/admin/access-control/users/__tests__/page.test.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US4, T058) — users page Telegram column + force-unlink action

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockUsers = vi.fn();
const mockOrgs = vi.fn();
const mockDeleteMutate = vi.fn();
const mockUnlinkMutate = vi.fn();

vi.mock('@/hooks/use-users', () => ({
  useUsers: () => mockUsers(),
  useDeleteUser: () => ({ mutate: mockDeleteMutate, isPending: false }),
  useUnlinkTelegram: () => ({ mutate: mockUnlinkMutate, isPending: false }),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useOrganizations: () => mockOrgs(),
}));

vi.mock('@/components/common/data-table', () => ({
  DataTable: ({
    columns,
    data,
  }: {
    columns: {
      id?: string;
      accessorKey?: string;
      header?: unknown;
      cell?: (ctx: { row: { original: unknown } }) => React.ReactNode;
    }[];
    data: Record<string, unknown>[];
  }) => {
    const tgCol = columns.find((c) => c.id === 'telegram');
    const actionCol = columns.find((c) => c.id === 'actions');
    return (
      <div data-testid="data-table">
        {data.map((row, i) => (
          <div key={i} data-testid="row">
            <span data-testid="telegram-cell">{tgCol?.cell ? tgCol.cell({ row: { original: row } }) : null}</span>
            <span data-testid="actions-cell">
              {actionCol?.cell ? actionCol.cell({ row: { original: row } }) : null}
            </span>
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock('@/components/admin/user-dialog', () => ({
  UserDialog: () => null,
}));

// Radix DropdownMenu ไม่เปิดใน jsdom — stub เป็น div/button ธรรมดา
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
}));

import UsersPage from '../page';

const baseUser = {
  publicId: 'u-1',
  username: 'somchai',
  email: 's@x.th',
  firstName: 'Som',
  lastName: 'Chai',
  isActive: true,
  roles: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOrgs.mockReturnValue({ data: [] });
});

describe('UsersPage — Telegram column & force-unlink (Feature 258 US4)', () => {
  it('renders ✈️ @username for linked users', () => {
    mockUsers.mockReturnValue({
      data: [
        {
          ...baseUser,
          telegramStatus: 'linked',
          telegramUsername: 'somchai_tg',
        },
      ],
      isLoading: false,
      isError: false,
    });
    render(<UsersPage />);
    expect(screen.getByTestId('telegram-cell').textContent).toContain('@somchai_tg');
  });

  it('renders ⚠️ Blocked badge for blocked users and — for none', () => {
    mockUsers.mockReturnValue({
      data: [
        { ...baseUser, publicId: 'u-2', telegramStatus: 'blocked' },
        { ...baseUser, publicId: 'u-3', username: 'nobind', telegramStatus: 'none' },
      ],
      isLoading: false,
      isError: false,
    });
    render(<UsersPage />);
    const cells = screen.getAllByTestId('telegram-cell');
    expect(cells[0].textContent).toContain('Blocked');
    expect(cells[1].textContent).toContain('—');
  });

  it('calls unlink mutation with user publicId after confirm', async () => {
    mockUsers.mockReturnValue({
      data: [{ ...baseUser, telegramStatus: 'linked', telegramUsername: 'somchai_tg' }],
      isLoading: false,
      isError: false,
    });
    render(<UsersPage />);

    // dropdown ถูก stub เป็น render ตรง — กด Unlink Telegram → confirm ใน AlertDialog
    fireEvent.click(screen.getByText('Unlink Telegram'));
    fireEvent.click(await screen.findByRole('button', { name: /^Unlink Telegram$/ }));

    await waitFor(() => {
      expect(mockUnlinkMutate).toHaveBeenCalledWith('u-1', expect.any(Object));
    });
  });

  it('hides unlink action when user has no Telegram binding', () => {
    mockUsers.mockReturnValue({
      data: [{ ...baseUser, telegramStatus: 'none' }],
      isLoading: false,
      isError: false,
    });
    render(<UsersPage />);
    expect(screen.queryByText('Unlink Telegram')).toBeNull();
  });
});
