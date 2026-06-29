// File: frontend/components/layout/__tests__/dashboard-shell.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for DashboardShell component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { act } from '@testing-library/react';
import { DashboardShell } from '../dashboard-shell';
import { useUIStore } from '@/lib/stores/ui-store';

describe('DashboardShell', () => {
  beforeEach(() => {
    act(() => {
      useUIStore.setState({ isSidebarOpen: true });
    });
  });

  it('ควรเรนเดอร์ children ได้ถูกต้อง', () => {
    render(
      <DashboardShell>
        <div>Test Content</div>
      </DashboardShell>,
    );
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('ควรมี class md:ml-[240px] เมื่อ isSidebarOpen เป็น true', () => {
    act(() => {
      useUIStore.setState({ isSidebarOpen: true });
    });
    const { container } = render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('md:ml-[240px]');
  });

  it('ควรมี class md:ml-[70px] เมื่อ isSidebarOpen เป็น false', () => {
    act(() => {
      useUIStore.setState({ isSidebarOpen: false });
    });
    const { container } = render(
      <DashboardShell>
        <div>Content</div>
      </DashboardShell>,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain('md:ml-[70px]');
  });
});
