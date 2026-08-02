// File: frontend/components/admin/__tests__/sidebar.test.tsx
// Change Log
// - 2026-06-13: Add coverage for admin sidebar navigation and expansion behavior.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminMobileSidebar, AdminSidebar } from '../sidebar';

const pathnameMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, onClick, className }: { href: string; children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

describe('AdminSidebar', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/admin/access-control/users');
  });

  it('auto-expands the active menu and renders child links', () => {
    render(<AdminSidebar />);
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'ผู้ใช้งาน' })).toHaveAttribute('href', '/admin/access-control/users');
    expect(screen.getByRole('link', { name: /back to dashboard/i })).toHaveAttribute('href', '/dashboard');
  });

  it('toggles a collapsed menu on click', async () => {
    const user = userEvent.setup();
    pathnameMock.mockReturnValue('/admin/settings');
    render(<AdminSidebar />);
    expect(screen.queryByRole('link', { name: 'โครงการ' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /ตั้งค่าโครงการ/i }));
    expect(screen.getByRole('link', { name: 'โครงการ' })).toBeInTheDocument();
  });
});

describe('AdminMobileSidebar', () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue('/admin/settings');
  });

  it('opens mobile navigation from trigger button', async () => {
    const user = userEvent.setup();
    render(<AdminMobileSidebar />);
    await user.click(screen.getByRole('button', { name: 'Toggle admin menu' }));
    expect(screen.getByText('Admin Navigation')).toBeInTheDocument();
    // AI Console เป็น collapsible menu ที่มี children — คลิกเพื่อขยาย
    await user.click(screen.getByRole('button', { name: /AI Console/i }));
    expect(screen.getByRole('link', { name: 'ระบบ' })).toHaveAttribute('href', '/admin/ai/system');
    expect(screen.getByRole('link', { name: 'RAG Playground' })).toHaveAttribute('href', '/admin/ai/rag-playground');
    expect(screen.getByRole('link', { name: 'แก้ไข Prompt' })).toHaveAttribute('href', '/admin/ai/prompts');
    expect(screen.getByRole('link', { name: 'ทดสอบ Sandbox' })).toHaveAttribute('href', '/admin/ai/sandbox');
  });
});
