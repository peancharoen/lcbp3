// File: frontend/components/admin/ai/__tests__/PromptTypeDropdown.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PromptTypeDropdown from '../PromptTypeDropdown';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
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

  it('renders correctly with default options', async () => {
    render(<PromptTypeDropdown value="ocr_extraction" onChange={vi.fn()} />);

    expect(screen.getByText('prompt_management.prompt_type')).toBeInTheDocument();

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('สกัดข้อความ OCR (OCR Extraction)');
  });

  it('renders all options when showAllOption is true', async () => {
    const user = userEvent.setup();
    render(<PromptTypeDropdown value="all" onChange={vi.fn()} showAllOption />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('prompt_management.all_types');

    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'prompt_management.all_types' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'สกัดข้อความ OCR (OCR Extraction)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'ค้นหาข้อมูล RAG (RAG Query)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'เตรียมข้อมูล RAG (RAG Prep)' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'จำแนกประเภทเอกสาร (Classification)' })).toBeInTheDocument();
    });
  });

  it('calls onChange when an option is selected', async () => {
    const user = userEvent.setup();
    const onChangeMock = vi.fn();
    render(<PromptTypeDropdown value="ocr_extraction" onChange={onChangeMock} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'ค้นหาข้อมูล RAG (RAG Query)' })).toBeInTheDocument();
    });

    const option = screen.getByRole('option', { name: 'ค้นหาข้อมูล RAG (RAG Query)' });
    await user.click(option);

    expect(onChangeMock).toHaveBeenCalledWith('rag_query_prompt');
  });
});
