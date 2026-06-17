// File: frontend/components/dashboard/__tests__/recent-activity.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RecentActivity } from '../recent-activity';
import { ActivityLog } from '@/types/dashboard';

describe('RecentActivity', () => {
  const mockActivities: ActivityLog[] = [
    {
      id: 'act-1',
      action: 'Created',
      description: 'Created new RFA-001',
      targetUrl: '/rfas/1',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(), // 5 minutes ago
      user: {
        id: 'u1',
        name: 'John Doe',
        initials: 'JD'
      }
    },
    {
      id: 'act-2',
      action: 'Approved',
      description: 'Approved Transmittal TR-005',
      targetUrl: '/transmittals/5',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
      user: {
        id: 'u2',
        name: 'Jane Smith',
        initials: 'JS'
      }
    }
  ];

  it('renders loading state when isLoading is true', () => {
    render(<RecentActivity activities={[]} isLoading={true} />);
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    // Check for skeletons (pulse animation)
    const cardContent = screen.getByText('Recent Activity').closest('.border');
    expect(cardContent?.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('renders empty state when no activities are present', () => {
    render(<RecentActivity activities={[]} isLoading={false} />);
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });

  it('handles undefined activities prop gracefully', () => {
    render(<RecentActivity activities={undefined} isLoading={false} />);
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity.')).toBeInTheDocument();
  });

  it('renders activities list correctly', () => {
    render(<RecentActivity activities={mockActivities} isLoading={false} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('Created')).toBeInTheDocument();
    expect(screen.getByText('Created new RFA-001')).toBeInTheDocument();
    
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('JS')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('Approved Transmittal TR-005')).toBeInTheDocument();
    
    // date-fns formatDistanceToNow will output text like '5 minutes ago', 'about 2 hours ago'
    // We can just verify some part of it or that it renders without error.
    const createdLink = screen.getByText('Created new RFA-001').closest('a');
    expect(createdLink).toHaveAttribute('href', '/rfas/1');
  });
});
