// File: frontend/components/admin/ai/__tests__/PromptTypeDropdown.test.tsx
// Change Log:
// - 2026-09-01: Update for dynamic ai_prompt_types master table (Feature 251)

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptTypeDropdown from '../PromptTypeDropdown';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [
      { publicId: '1', promptType: 'ocr_extraction', displayName: 'OCR Extraction', isSystemManaged: true, isActive: true },
      { publicId: '2', promptType: 'rag_query_prompt', displayName: 'RAG Query', isSystemManaged: true, isActive: true },
      { publicId: '3', promptType: 'rag_prep_prompt', displayName: 'RAG Prep', isSystemManaged: true, isActive: true },
      { publicId: '4', promptType: 'classification_prompt', displayName: 'Classification', isSystemManaged: true, isActive: true },
    ],
    isLoading: false,
  }),
}));

// ResizeObserver mock is needed for Radix UI select
class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

describe('PromptTypeDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // mock pointer event for Radix UI
    window.PointerEvent = MouseEvent as any;
  });

  it('renders correctly with dynamic prompt types', async () => {
    render(<PromptTypeDropdown value="ocr_extraction" onChange={vi.fn()} />);

    expect(screen.getByText('prompt_management.prompt_type')).toBeInTheDocument();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('OCR Extraction');
  });

  it('renders all loaded prompt type options', async () => {
    const user = userEvent.setup();
    render(<PromptTypeDropdown value="ocr_extraction" onChange={vi.fn()} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'OCR Extraction' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'RAG Query' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'RAG Prep' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Classification' })).toBeInTheDocument();
    });
  });

  it('calls onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<PromptTypeDropdown value="ocr_extraction" onChange={onChangeMock} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'RAG Query' })).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: 'RAG Query' });
    await user.click(option);

    expect(onChangeMock).toHaveBeenCalledWith('rag_query_prompt');
  });
});
