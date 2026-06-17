// File: frontend/components/numbering/__tests__/void-replace-form.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VoidReplaceForm } from '../void-replace-form';
import { documentNumberingService } from '@/lib/services/document-numbering.service';
import { toast } from 'sonner';

vi.mock('@/lib/services/document-numbering.service', () => ({
  documentNumberingService: {
    voidAndReplace: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('VoidReplaceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly', () => {
    render(<VoidReplaceForm projectId={1} />);
    expect(screen.getByText('Void & Replace Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Document Number')).toBeInTheDocument();
    expect(screen.getByLabelText('Reason')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Generate Replacement?' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Void Number' })).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup();
    render(<VoidReplaceForm projectId={1} />);
    
    const button = screen.getByRole('button', { name: 'Void Number' });
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Document Number is required')).toBeInTheDocument();
      expect(screen.getByText('Reason must be at least 5 characters')).toBeInTheDocument();
    });
    
    expect(documentNumberingService.voidAndReplace).not.toHaveBeenCalled();
  });

  it('shows validation error for short reason', async () => {
    const user = userEvent.setup();
    render(<VoidReplaceForm projectId={1} />);
    
    await user.type(screen.getByLabelText('Document Number'), 'DOC-001');
    await user.type(screen.getByLabelText('Reason'), '123'); // Too short
    
    const button = screen.getByRole('button', { name: 'Void Number' });
    await user.click(button);
    
    await waitFor(() => {
      expect(screen.getByText('Reason must be at least 5 characters')).toBeInTheDocument();
    });
    
    expect(documentNumberingService.voidAndReplace).not.toHaveBeenCalled();
  });

  it('handles successful voiding without replacement', async () => {
    const user = userEvent.setup();
    render(<VoidReplaceForm projectId={1} />);
    
    await user.type(screen.getByLabelText('Document Number'), 'DOC-001');
    await user.type(screen.getByLabelText('Reason'), 'Voided because of typo');
    
    vi.mocked(documentNumberingService.voidAndReplace).mockResolvedValue({} as any);
    
    const button = screen.getByRole('button', { name: 'Void Number' });
    await user.click(button);
    
    expect(documentNumberingService.voidAndReplace).toHaveBeenCalledWith({
      documentNumber: 'DOC-001',
      reason: 'Voided because of typo',
      replace: false,
      projectId: 1,
    });
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Number voided successfully. ');
    });
  });

  it('handles successful voiding with replacement', async () => {
    const user = userEvent.setup();
    render(<VoidReplaceForm projectId={1} />);
    
    await user.type(screen.getByLabelText('Document Number'), 'DOC-002');
    await user.type(screen.getByLabelText('Reason'), 'Voided because of typo');
    
    const checkbox = screen.getByRole('checkbox', { name: 'Generate Replacement?' });
    await user.click(checkbox);
    
    vi.mocked(documentNumberingService.voidAndReplace).mockResolvedValue({} as any);
    
    const button = screen.getByRole('button', { name: 'Void Number' });
    await user.click(button);
    
    expect(documentNumberingService.voidAndReplace).toHaveBeenCalledWith({
      documentNumber: 'DOC-002',
      reason: 'Voided because of typo',
      replace: true,
      projectId: 1,
    });
    
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Number voided successfully. Replacement generated.');
    });
  });

  it('handles API error', async () => {
    const user = userEvent.setup();
    render(<VoidReplaceForm projectId={1} />);
    
    await user.type(screen.getByLabelText('Document Number'), 'DOC-001');
    await user.type(screen.getByLabelText('Reason'), 'Voided because of typo');
    
    vi.mocked(documentNumberingService.voidAndReplace).mockRejectedValue(new Error('Failed'));
    
    const button = screen.getByRole('button', { name: 'Void Number' });
    await user.click(button);
    
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to void number. Check if it exists.');
    });
  });
});
