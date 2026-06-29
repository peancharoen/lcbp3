// File: components/search/__tests__/filters.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SearchFilters } from '../filters';

describe('SearchFilters', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ควร render filters card', () => {
    const filters = { types: [], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('ควรแสดง Document Type checkboxes', () => {
    const filters = { types: [], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('Document Type')).toBeInTheDocument();
    expect(screen.getByText('Correspondence')).toBeInTheDocument();
    expect(screen.getByText('RFA')).toBeInTheDocument();
    expect(screen.getByText('Drawing')).toBeInTheDocument();
  });

  it('ควรแสดง Status checkboxes', () => {
    const filters = { types: [], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('ควรแสดง active count badge เมื่อมี filters', () => {
    const filters = { types: ['correspondence'], statuses: ['DRAFT'] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('2 active')).toBeInTheDocument();
  });

  it('ควรไม่แสดง active count badge เมื่อไม่มี filters', () => {
    const filters = { types: [], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.queryByText(/active/)).not.toBeInTheDocument();
  });

  it('ควรแสดง Clear all filters button เมื่อมี active filters', () => {
    const filters = { types: ['correspondence'], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.getByText('Clear all filters')).toBeInTheDocument();
  });

  it('ควรไม่แสดง Clear all filters button เมื่อไม่มี active filters', () => {
    const filters = { types: [], statuses: [] };
    render(<SearchFilters filters={filters} onFilterChange={mockOnFilterChange} />);

    expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
  });
});
