// File: frontend/components/dashboard/__tests__/pending-tasks.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PendingTasks } from '../pending-tasks';
import { PendingTask } from '@/types/dashboard';

describe('PendingTasks', () => {
  const mockTasks: PendingTask[] = [
    {
      publicId: 'task-1',
      title: 'Review RFA-001',
      description: 'Needs structural review',
      type: 'rfa_review',
      dueDate: new Date('2026-06-10T00:00:00Z').toISOString(),
      daysOverdue: 5,
      url: '/rfas/task-1'
    },
    {
      publicId: 'task-2',
      title: 'Approve Transmittal',
      description: 'Monthly submittals',
      type: 'transmittal_approval',
      dueDate: new Date('2026-06-20T00:00:00Z').toISOString(),
      daysOverdue: 0,
      url: '/transmittals/task-2'
    }
  ];

  it('renders loading state when isLoading is true', () => {
    render(<PendingTasks tasks={[]} isLoading={true} />);
    
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    // Check for skeletons (pulse animation)
    const cardContent = screen.getByText('Pending Tasks').closest('.border');
    expect(cardContent?.querySelectorAll('.animate-pulse').length).toBe(3);
  });

  it('renders empty state when no tasks are present', () => {
    render(<PendingTasks tasks={[]} isLoading={false} />);
    
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('No pending tasks. Good job!')).toBeInTheDocument();
  });

  it('handles undefined tasks prop gracefully', () => {
    render(<PendingTasks tasks={undefined} isLoading={false} />);
    
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('No pending tasks. Good job!')).toBeInTheDocument();
  });

  it('renders tasks list correctly', () => {
    render(<PendingTasks tasks={mockTasks} isLoading={false} />);
    
    expect(screen.getByText('Review RFA-001')).toBeInTheDocument();
    expect(screen.getByText('Needs structural review')).toBeInTheDocument();
    expect(screen.getByText('Approve Transmittal')).toBeInTheDocument();
    expect(screen.getByText('Monthly submittals')).toBeInTheDocument();

    // Check count badge
    const countBadge = screen.getByText('2');
    expect(countBadge).toHaveClass('bg-destructive');
  });

  it('displays correct badges for overdue and due soon tasks', () => {
    render(<PendingTasks tasks={mockTasks} isLoading={false} />);
    
    const overdueBadge = screen.getByText('5d overdue');
    expect(overdueBadge).toHaveClass('bg-destructive');

    const dueSoonBadge = screen.getByText('Due Soon');
    expect(dueSoonBadge).toHaveClass('border-yellow-200');
  });
});
