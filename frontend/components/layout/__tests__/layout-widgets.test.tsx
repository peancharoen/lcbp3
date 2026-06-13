// File: frontend/components/layout/__tests__/layout-widgets.test.tsx
// Change Log:
// - 2026-06-14: Add coverage for uncovered layout widgets and navigation interactions

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { GlobalSearch } from '../global-search';
import { MobileSidebar, Sidebar } from '../sidebar';
import { ProjectSwitcher } from '../project-switcher';
import { NotificationsDropdown } from '../notifications-dropdown';
import { UserMenu } from '../user-menu';
import { useProjectStore } from '@/lib/stores/project-store';
import { useAuthStore } from '@/lib/stores/auth-store';

const mocks = vi.hoisted(() => ({
  routerPush: vi.fn(),
  markAsRead: vi.fn(),
  signOut: vi.fn(),
  pathname: '/correspondences',
  searchType: '',
  suggestions: [
    {
      uuid: '019505a1-7c3e-7000-8000-abc123def501',
      type: 'correspondence',
      title: 'Incoming Correspondence',
      documentNumber: 'COR-001',
    },
  ],
  searchLoading: false,
  projects: [
    {
      publicId: '019505a1-7c3e-7000-8000-abc123def601',
      projectName: 'Project One',
    },
    {
      publicId: '019505a1-7c3e-7000-8000-abc123def602',
      projectName: 'Project Two',
    },
  ],
  projectsLoading: false,
  notifications: {
    items: [
      {
        publicId: '019505a1-7c3e-7000-8000-abc123def701',
        notificationId: 1,
        title: 'Workflow task',
        message: 'Please review the RFA',
        type: 'INFO',
        isRead: false,
        createdAt: '2026-06-14T00:00:00Z',
        link: '/review-tasks',
      },
    ],
    unreadCount: 1,
  },
  notificationsLoading: false,
  session: {
    user: {
      name: 'DMS Admin',
      email: 'admin@example.local',
      role: 'ADMIN',
    },
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.routerPush }),
  usePathname: () => mocks.pathname,
  useSearchParams: () => ({
    get: (key: string) => (key === 'type' ? mocks.searchType : null),
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, className, title }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} onClick={onClick} className={className} title={title}>
      {children}
    </a>
  ),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: mocks.session }),
  signOut: mocks.signOut,
}));

vi.mock('@/hooks/use-search', () => ({
  useSearchSuggestions: () => ({
    data: mocks.suggestions,
    isLoading: mocks.searchLoading,
  }),
}));

vi.mock('@/hooks/use-projects', () => ({
  useProjects: () => ({
    data: mocks.projects,
    isLoading: mocks.projectsLoading,
  }),
}));

vi.mock('@/hooks/use-notification', () => ({
  useNotifications: () => ({
    data: mocks.notifications,
    isLoading: mocks.notificationsLoading,
  }),
  useMarkNotificationRead: () => ({
    mutate: mocks.markAsRead,
  }),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <select data-testid="project-select" value={value} onChange={(event) => onValueChange?.(event.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <option value="">{placeholder}</option>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <option value={value}>{children}</option>,
}));

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    disabled,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    className?: string;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children, heading }: { children: React.ReactNode; heading?: string }) => (
    <div>
      {heading && <div>{heading}</div>}
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect }: { children: React.ReactNode; onSelect?: () => void }) => (
    <button type="button" onClick={onSelect}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SheetContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
}));

describe('layout widgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/correspondences';
    mocks.searchType = '';
    mocks.projects = [
      { publicId: '019505a1-7c3e-7000-8000-abc123def601', projectName: 'Project One' },
      { publicId: '019505a1-7c3e-7000-8000-abc123def602', projectName: 'Project Two' },
    ];
    mocks.projectsLoading = false;
    mocks.notificationsLoading = false;
    mocks.notifications = {
      items: [
        {
          publicId: '019505a1-7c3e-7000-8000-abc123def701',
          notificationId: 1,
          title: 'Workflow task',
          message: 'Please review the RFA',
          type: 'INFO',
          isRead: false,
          createdAt: '2026-06-14T00:00:00Z',
          link: '/review-tasks',
        },
      ],
      unreadCount: 1,
    };
    useProjectStore.setState({ selectedProjectId: null });
    useAuthStore.setState({
      user: {
        id: '019505a1-7c3e-7000-8000-abc123def801',
        publicId: '019505a1-7c3e-7000-8000-abc123def801',
        username: 'admin',
        email: 'admin@example.local',
        firstName: 'DMS',
        lastName: 'Admin',
        role: 'ADMIN',
      },
      token: 'token',
      isAuthenticated: true,
    });
  });

  it('Sidebar ควรแสดงเมนู admin และ collapse label ได้', () => {
    render(<Sidebar />);
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
    expect(screen.getByTitle('Admin Panel')).toBeInTheDocument();
  });

  it('MobileSidebar ควร render navigation และซ่อน admin เมื่อ role ไม่ใช่ admin', () => {
    useAuthStore.setState({
      user: {
        id: '019505a1-7c3e-7000-8000-abc123def802',
        publicId: '019505a1-7c3e-7000-8000-abc123def802',
        username: 'viewer',
        email: 'viewer@example.local',
        firstName: 'DMS',
        lastName: 'Viewer',
        role: 'User',
      },
      token: 'token',
      isAuthenticated: true,
    });
    render(<MobileSidebar />);
    expect(screen.getByText('Mobile Navigation')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Admin Panel')).not.toBeInTheDocument();
  });

  it('GlobalSearch ควร submit query และเปิด suggestion route ได้', async () => {
    render(<GlobalSearch />);
    const input = screen.getByPlaceholderText('Search documents...');
    fireEvent.change(input, { target: { value: 'rfa search' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mocks.routerPush).toHaveBeenCalledWith('/search?q=rfa%20search');
    fireEvent.focus(input);
    await waitFor(() => expect(screen.getByText('Incoming Correspondence')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Incoming Correspondence'));
    expect(mocks.routerPush).toHaveBeenCalledWith('/correspondences/019505a1-7c3e-7000-8000-abc123def501');
  });

  it('ProjectSwitcher ควรเลือก project และ global ได้', () => {
    render(<ProjectSwitcher />);
    const select = screen.getByTestId('project-select');
    fireEvent.change(select, { target: { value: '019505a1-7c3e-7000-8000-abc123def602' } });
    expect(useProjectStore.getState().selectedProjectId).toBe('019505a1-7c3e-7000-8000-abc123def602');
    fireEvent.change(select, { target: { value: 'global' } });
    expect(useProjectStore.getState().selectedProjectId).toBeNull();
  });

  it('ProjectSwitcher ควร auto-select เมื่อมี project เดียวและแสดง loading/empty state ได้', async () => {
    mocks.projects = [{ publicId: '019505a1-7c3e-7000-8000-abc123def603', projectName: 'Single Project' }];
    const { rerender, container } = render(<ProjectSwitcher />);
    await waitFor(() => expect(useProjectStore.getState().selectedProjectId).toBe('019505a1-7c3e-7000-8000-abc123def603'));
    expect(screen.getByText('Single Project')).toBeInTheDocument();
    mocks.projectsLoading = true;
    rerender(<ProjectSwitcher />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    mocks.projectsLoading = false;
    mocks.projects = [];
    rerender(<ProjectSwitcher />);
    expect(screen.queryByText('Single Project')).not.toBeInTheDocument();
  });

  it('NotificationsDropdown ควร mark read และ navigate เมื่อคลิก notification', () => {
    render(<NotificationsDropdown />);
    expect(screen.getByText('1')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Workflow task'));
    expect(mocks.markAsRead).toHaveBeenCalledWith('019505a1-7c3e-7000-8000-abc123def701');
    expect(mocks.routerPush).toHaveBeenCalledWith('/review-tasks');
  });

  it('NotificationsDropdown ควรแสดง loading และ empty state ได้', () => {
    mocks.notificationsLoading = true;
    const { rerender, container } = render(<NotificationsDropdown />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    mocks.notificationsLoading = false;
    mocks.notifications = { items: [], unreadCount: 0 };
    rerender(<NotificationsDropdown />);
    expect(screen.getByText('No new notifications')).toBeInTheDocument();
  });

  it('UserMenu ควรแสดงข้อมูล session และ logout กลับ login', async () => {
    mocks.signOut.mockResolvedValueOnce(undefined);
    render(<UserMenu />);
    expect(screen.getByText('DMS Admin')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Profile'));
    expect(mocks.routerPush).toHaveBeenCalledWith('/profile');
    fireEvent.click(screen.getByText('Settings'));
    expect(mocks.routerPush).toHaveBeenCalledWith('/settings');
    fireEvent.click(screen.getByText('Log out'));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false }));
    expect(mocks.routerPush).toHaveBeenCalledWith('/login');
  });
});
