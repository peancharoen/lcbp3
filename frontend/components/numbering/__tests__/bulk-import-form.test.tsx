// File: frontend/components/numbering/__tests__/bulk-import-form.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkImportForm } from '../bulk-import-form';
import { documentNumberingService } from '@/lib/services/document-numbering.service';
import { toast } from 'sonner';

vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    bulkImport: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('BulkImportForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<BulkImportForm projectId={1} />);
    expect(screen.getByText('Bulk Import Numbers')).toBeInTheDocument();
    expect(screen.getByLabelText('CSV File')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload & Import' })).toBeDisabled();
  });

  it('enables submit button when file is selected and handles successful upload', async () => {
    const user = userEvent.setup();
    render(<BulkImportForm projectId={1} />);
    
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText('CSV File') as HTMLInputElement;
    
    await user.upload(input, file);
    
    const button = screen.getByRole('button', { name: 'Upload & Import' });
    expect(button).not.toBeDisabled();
    
    vi.mocked(documentNumberingService.bulkImport).mockResolvedValue({} as any);
    
    await user.click(button);
    
    expect(documentNumberingService.bulkImport).toHaveBeenCalledWith(expect.any(FormData));
    const formDataArg = vi.mocked(documentNumberingService.bulkImport).mock.calls[0][0] as FormData;
    expect(formDataArg.get('file')).toBe(file);
    expect(formDataArg.get('projectId')).toBe('1');
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Bulk import initiated. Check audit logs for progress.');
    });
    
    // File input reset means button is disabled again
    expect(button).toBeDisabled();
  });

  it('handles upload failure', async () => {
    const user = userEvent.setup();
    render(<BulkImportForm projectId={1} />);
    
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });
    const input = screen.getByLabelText('CSV File') as HTMLInputElement;
    
    await user.upload(input, file);
    
    const button = screen.getByRole('button', { name: 'Upload & Import' });
    
    vi.mocked(documentNumberingService.bulkImport).mockRejectedValue(new Error('Failed'));
    
    await user.click(button);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to import numbers.');
    });
  });
});
