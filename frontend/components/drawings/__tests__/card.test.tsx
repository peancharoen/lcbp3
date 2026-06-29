// File: frontend/components/drawings/__tests__/card.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for DrawingCard component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawingCard } from '../card';

describe('DrawingCard', () => {
  const mockDrawing = {
    publicId: '019505a1-7c3e-7000-8000-abc123def456',
    drawingNumber: 'SD-001',
    title: 'Test Drawing',
    sheetNumber: 'A1',
    revision: 'A',
    scale: '1:100',
    issueDate: '2026-01-01',
    discipline: {
      publicId: '019505a1-7c3e-7000-8000-abc123def457',
      disciplineCode: 'STR',
    },
    revisionCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render drawing card with data', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('SD-001')).toBeInTheDocument();
    expect(screen.getByText('Test Drawing')).toBeInTheDocument();
    expect(screen.getByText('STR')).toBeInTheDocument();
  });

  it('should render placeholder when drawing number is missing', () => {
    const drawingWithoutNumber = { ...mockDrawing, drawingNumber: undefined };
    render(<DrawingCard drawing={drawingWithoutNumber} />);

    expect(screen.getByText('No Number')).toBeInTheDocument();
  });

  it('should render placeholder when title is missing', () => {
    const drawingWithoutTitle = { ...mockDrawing, title: undefined };
    render(<DrawingCard drawing={drawingWithoutTitle} />);

    expect(screen.getByText('No Title')).toBeInTheDocument();
  });

  it('should display sheet number', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('Sheet:')).toBeInTheDocument();
    expect(screen.getByText('A1')).toBeInTheDocument();
  });

  it('should display revision', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('Rev:')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
  });

  it('should display scale', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('Scale:')).toBeInTheDocument();
    expect(screen.getByText('1:100')).toBeInTheDocument();
  });

  it('should display formatted issue date', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('Date:')).toBeInTheDocument();
    expect(screen.getByText('01/01/2026')).toBeInTheDocument();
  });

  it('should display legacy drawing number when present', () => {
    const drawingWithLegacy = { ...mockDrawing, legacyDrawingNumber: 'LEG-001' };
    render(<DrawingCard drawing={drawingWithLegacy} />);

    expect(screen.getByText('Legacy:')).toBeInTheDocument();
    expect(screen.getByText('LEG-001')).toBeInTheDocument();
  });

  it('should display volume page when present', () => {
    const drawingWithPage = { ...mockDrawing, volumePage: 5 };
    render(<DrawingCard drawing={drawingWithPage} />);

    expect(screen.getByText('Page:')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display discipline code from object', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('STR')).toBeInTheDocument();
  });

  it('should display discipline code from string', () => {
    const drawingWithStringDiscipline = { ...mockDrawing, discipline: 'MECH' };
    render(<DrawingCard drawing={drawingWithStringDiscipline} />);

    expect(screen.getByText('MECH')).toBeInTheDocument();
  });

  it('should show View button with link', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    const viewButton = screen.getByText('View');
    expect(viewButton).toBeInTheDocument();
    expect(viewButton.closest('a')).toHaveAttribute('href', '/drawings/019505a1-7c3e-7000-8000-abc123def456');
  });

  it('should show Download button', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.getByText('Download')).toBeInTheDocument();
  });

  it('should show Compare button when revisionCount > 1', () => {
    const drawingWithRevisions = { ...mockDrawing, revisionCount: 2 };
    render(<DrawingCard drawing={drawingWithRevisions} />);

    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('should not show Compare button when revisionCount <= 1', () => {
    render(<DrawingCard drawing={mockDrawing} />);

    expect(screen.queryByText('Compare')).not.toBeInTheDocument();
  });

  it('should display dash for missing sheet number', () => {
    const drawingWithoutSheet = { ...mockDrawing, sheetNumber: undefined };
    render(<DrawingCard drawing={drawingWithoutSheet} />);

    expect(screen.getByText('Sheet:')).toBeInTheDocument();
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('should display 0 for missing revision', () => {
    const drawingWithoutRevision = { ...mockDrawing, revision: undefined };
    render(<DrawingCard drawing={drawingWithoutRevision} />);

    expect(screen.getByText('Rev:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should display N/A for missing scale', () => {
    const drawingWithoutScale = { ...mockDrawing, scale: undefined };
    render(<DrawingCard drawing={drawingWithoutScale} />);

    expect(screen.getByText('Scale:')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
  });

  it('should not display date when issueDate is missing', () => {
    const drawingWithoutDate = { ...mockDrawing, issueDate: undefined };
    render(<DrawingCard drawing={drawingWithoutDate} />);

    expect(screen.getByText('Date:')).toBeInTheDocument();
  });
});
