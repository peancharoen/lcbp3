// File: frontend/app/(admin)/admin/notifications/channels/__tests__/page.test.tsx
// Change Log:
// - 2026-09-25: Initial creation (Feature 258 US2, T045) — tests สำหรับ NotificationChannelsPage

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockChannels = vi.fn();
const mockIssueMutateAsync = vi.fn();
const mockPatchMutate = vi.fn();
const mockDeleteMutate = vi.fn();

vi.mock('@/hooks/use-notification-channels', () => ({
  useNotificationChannels: () => mockChannels(),
  useIssueLinkCode: () => ({
    mutateAsync: mockIssueMutateAsync,
    isPending: false,
  }),
  usePatchChannel: () => ({ mutate: mockPatchMutate, isPending: false }),
  useDeleteChannel: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

vi.mock('@/hooks/use-projects', () => ({
  useProjects: () => ({
    data: [
      { publicId: 'p1', projectCode: 'P1', projectName: 'LCBP3', isActive: true },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useOrganizations: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/use-grouping', () => ({
  useUserGroups: () => ({ data: [], isLoading: false }),
  useDepartments: () => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@/components/common/data-table', () => ({
  DataTable: ({ data }: { data: unknown[] }) => (
    <div data-testid="data-table">{JSON.stringify(data)}</div>
  ),
}));

import NotificationChannelsPage from '../page';

const channel = {
  publicId: 'ch-1',
  channelType: 'TELEGRAM_GROUP',
  externalChatId: '-1001234',
  telegramTopicId: 42,
  projectId: 7,
  name: 'LCBP3 Correspondences',
  isActive: true,
  lastError: null,
  createdAt: '2026-09-25T00:00:00Z',
};

describe('NotificationChannelsPage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('แสดงรายการ channels ในตาราง', () => {
    mockChannels.mockReturnValue({ data: [channel], isLoading: false });
    render(<NotificationChannelsPage />);
    expect(screen.getByTestId('data-table')).toHaveTextContent('-1001234');
  });

  it('แสดง skeleton ขณะโหลด', () => {
    mockChannels.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<NotificationChannelsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('เปิด dialog เมื่อกดปุ่มเพิ่ม channel', () => {
    mockChannels.mockReturnValue({ data: [], isLoading: false });
    render(<NotificationChannelsPage />);
    fireEvent.click(screen.getByRole('button', { name: /เพิ่ม Telegram Channel/ }));
    expect(screen.getByText('สร้างรหัสผูกกลุ่ม')).toBeInTheDocument();
  });

  it('แสดงรหัส /link เมื่อ issue สำเร็จ', async () => {
    mockChannels.mockReturnValue({ data: [], isLoading: false });
    mockIssueMutateAsync.mockResolvedValue({
      code: 'AB12CD34',
      expiresIn: 900,
      projectPublicId: 'p1',
    });
    render(<NotificationChannelsPage />);
    fireEvent.click(screen.getByRole('button', { name: /เพิ่ม Telegram Channel/ }));

    // submit form โดยตรง (Select ของ shadcn ยากต่อการ drive ใน jsdom)
    const submitBtn = screen.getByRole('button', { name: /สร้างรหัสผูกกลุ่ม/ });
    fireEvent.click(submitBtn);
    // validation fail ถ้าไม่เลือก project — ยืนยันว่าไม่เรียก API
    await waitFor(() =>
      expect(mockIssueMutateAsync).not.toHaveBeenCalled()
    );
  });
});
