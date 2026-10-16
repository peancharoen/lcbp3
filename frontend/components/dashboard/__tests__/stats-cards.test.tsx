// File: frontend/components/dashboard/__tests__/stats-cards.test.tsx
// Change Log:
// - 2026-10-16: เพิ่มการ์ด Documents This Month / Total Circulations (6 การ์ด)
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCards } from '../stats-cards';
import { DashboardStats } from '@/types/dashboard';

describe('StatsCards', () => {
  const mockStats: DashboardStats = {
    totalDocuments: 150,
    totalRfas: 45,
    totalCirculations: 30,
    documentsThisMonth: 12,
    approved: 120,
    pendingApprovals: 15,
  };

  it('renders loading state when isLoading is true', () => {
    // using container to query raw DOM for animate-pulse since skeletons don't have text
    const { container } = render(<StatsCards stats={mockStats} isLoading={true} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(6);
  });

  it('renders loading state when stats is undefined', () => {
    const { container } = render(<StatsCards stats={undefined} isLoading={false} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(6);
  });

  it('renders stats cards correctly with values', () => {
    render(<StatsCards stats={mockStats} isLoading={false} />);

    expect(screen.getByText('Total Correspondences')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();

    expect(screen.getByText('Active RFAs')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();

    expect(screen.getByText('Total Circulations')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();

    expect(screen.getByText('Documents This Month')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();

    expect(screen.getByText('Approved Documents')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();

    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});
