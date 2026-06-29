// File: frontend/components/dashboard/__tests__/stats-cards.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatsCards } from '../stats-cards';
import { DashboardStats } from '@/types/dashboard';

describe('StatsCards', () => {
  const mockStats: DashboardStats = {
    totalDocuments: 150,
    totalRfas: 45,
    approved: 120,
    pendingApprovals: 15
  };

  it('renders loading state when isLoading is true', () => {
    // using container to query raw DOM for animate-pulse since skeletons don't have text
    const { container } = render(<StatsCards stats={mockStats} isLoading={true} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(4);
  });

  it('renders loading state when stats is undefined', () => {
    const { container } = render(<StatsCards stats={undefined} isLoading={false} />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(4);
  });

  it('renders stats cards correctly with values', () => {
    render(<StatsCards stats={mockStats} isLoading={false} />);
    
    expect(screen.getByText('Total Correspondences')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();

    expect(screen.getByText('Active RFAs')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();

    expect(screen.getByText('Approved Documents')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();

    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });
});
