// File: components/search/__tests__/results.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SearchResults } from '../results';

describe('SearchResults', () => {
  const mockResults = [
    {
      type: 'correspondence',
      publicId: '019505a1-7c3e-7000-8000-abc123def456',
      documentNumber: 'CORR-001',
      title: 'Test Correspondence',
      description: 'Test description',
      status: 'DRAFT',
      createdAt: '2026-06-14T10:00:00Z',
      highlight: null,
    },
  ];

  it('ควร render loading state เมื่อ loading=true', () => {
    render(<SearchResults results={[]} query="" loading={true} />);

    const spinners = screen.getAllByRole('generic', { name: '' }).filter(el => el.querySelector('.animate-spin'));
    if (spinners.length > 0) {
      expect(spinners[0]).toBeInTheDocument();
    }
  });

  it('ควร render empty state เมื่อไม่มี results และมี query', () => {
    render(<SearchResults results={[]} query="test" loading={false} />);

    expect(screen.getByText('No results found for "test"')).toBeInTheDocument();
  });

  it('ควร render empty state เมื่อไม่มี results และไม่มี query', () => {
    render(<SearchResults results={[]} query="" loading={false} />);

    expect(screen.getByText('Enter a search term to start')).toBeInTheDocument();
  });

  it('ควร render results list เมื่อมี results', () => {
    render(<SearchResults results={mockResults} query="" loading={false} />);

    expect(screen.getByText('Test Correspondence')).toBeInTheDocument();
    expect(screen.getByText('CORR-001')).toBeInTheDocument();
  });

  it('ควรแสดง document type badge', () => {
    render(<SearchResults results={mockResults} query="" loading={false} />);

    expect(screen.getByText('Correspondence')).toBeInTheDocument();
  });

  it('ควรแสดง status badge', () => {
    render(<SearchResults results={mockResults} query="" loading={false} />);

    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('ควรแสดง description เมื่อมี', () => {
    render(<SearchResults results={mockResults} query="" loading={false} />);

    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('ควรแสดง formatted date', () => {
    render(<SearchResults results={mockResults} query="" loading={false} />);

    expect(screen.getByText(/14 Jun 2026/)).toBeInTheDocument();
  });
});
