// File: frontend/components/admin/ai/__tests__/PromptEditor.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptEditor from '../PromptEditor';

// Mock PLACEHOLDER_REQUIREMENTS
vi.mock('@/contracts/frontend-types', () => ({
  PLACEHOLDER_REQUIREMENTS: {
    ocr_extraction: ['{{ocr_text}}'],
    rag_query_prompt: ['{{query}}'],
  },
}));

describe('PromptEditor', () => {
  const defaultProps = {
    promptType: 'ocr_extraction' as const,
    initialTemplate: 'Hello {{ocr_text}}',
    onSave: vi.fn(),
    isSaving: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with initial template', () => {
    render(<PromptEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('เขียนพรอมต์ของคุณที่นี่...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('Hello {{ocr_text}}');
  });

  it('disables save button if required placeholders are missing', async () => {
    const user = userEvent.setup();
    render(<PromptEditor {...defaultProps} initialTemplate="Hello world" />);
    
    // Check missing validation message
    expect(screen.getByText(/ต้องมีตัวแปร/i)).toBeInTheDocument();
    expect(screen.getByText('{{ocr_text}}')).toBeInTheDocument();

    const saveButton = screen.getByRole('button', { name: /บันทึกเวอร์ชันใหม่/i });
    expect(saveButton).toBeDisabled();
  });

  it('enables save button when placeholders are present and calls onSave', async () => {
    const user = userEvent.setup();
    render(<PromptEditor {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText('เขียนพรอมต์ของคุณที่นี่...') as HTMLTextAreaElement;
    await user.type(textarea, ' is awesome');

    const noteInput = screen.getByPlaceholderText(/เช่น ปรับปรุงสัดส่วนความเที่ยงตรง/i);
    await user.type(noteInput, 'Test Note');

    const saveButton = screen.getByRole('button', { name: /บันทึกเวอร์ชันใหม่/i });
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    expect(defaultProps.onSave).toHaveBeenCalledWith('Hello {{ocr_text}} is awesome', 'Test Note');
  });
});
