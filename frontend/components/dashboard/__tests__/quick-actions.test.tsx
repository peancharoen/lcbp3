// File: frontend/components/dashboard/__tests__/quick-actions.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QuickActions } from '../quick-actions';

// Mock Next.js Link component
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  )
}));

describe('QuickActions', () => {
  it('renders all quick action links correctly', () => {
    render(<QuickActions />);
    
    const newRfaLink = screen.getByRole('link', { name: /new rfa/i });
    expect(newRfaLink).toHaveAttribute('href', '/rfas/new');
    
    const newCorrespondenceLink = screen.getByRole('link', { name: /new correspondence/i });
    expect(newCorrespondenceLink).toHaveAttribute('href', '/correspondences/new');
    
    const uploadDrawingLink = screen.getByRole('link', { name: /upload drawing/i });
    expect(uploadDrawingLink).toHaveAttribute('href', '/drawings/upload');
  });
});
