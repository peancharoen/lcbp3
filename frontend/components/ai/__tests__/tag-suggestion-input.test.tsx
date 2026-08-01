// File: frontend/components/ai/__tests__/tag-suggestion-input.test.tsx
// Change Log:
// - 2026-07-31: Initial test for TagSuggestionInput (Pipeline B)

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TagSuggestionInput } from '../tag-suggestion-input';
import type { SuggestedTag } from '@/types/ai';

const existingTag: SuggestedTag = {
  name: 'Invoice',
  isNew: false,
  publicId: 'uuid-123',
  confidence: 0.95,
};

const newTag: SuggestedTag = {
  name: 'Urgent-Payment',
  isNew: true,
  confidence: 0.8,
};

describe('TagSuggestionInput', () => {
  it('renders pending AI suggestions', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[existingTag, newTag]}
        selectedTags={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByText('Urgent-Payment')).toBeInTheDocument();
  });

  it('calls onChange when accepting a suggestion', () => {
    const onChange = vi.fn();
    render(
      <TagSuggestionInput
        suggestedTags={[existingTag]}
        selectedTags={[]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByText('Invoice'));
    expect(onChange).toHaveBeenCalledWith([existingTag]);
  });

  it('shows selected tags with remove button', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[existingTag]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('Invoice')).toBeInTheDocument();
    expect(screen.getByLabelText('Remove Invoice')).toBeInTheDocument();
  });

  it('calls onChange when removing a tag', () => {
    const onChange = vi.fn();
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[existingTag, newTag]}
        onChange={onChange}
      />
    );
    fireEvent.click(screen.getByLabelText('Remove Invoice'));
    expect(onChange).toHaveBeenCalledWith([newTag]);
  });

  it('adds manual tag via input', () => {
    const onChange = vi.fn();
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[]}
        onChange={onChange}
      />
    );
    const input = screen.getByPlaceholderText('Add tag manually...');
    fireEvent.change(input, { target: { value: 'CustomTag' } });
    fireEvent.click(screen.getByText('Add'));
    expect(onChange).toHaveBeenCalledWith([
      { name: 'CustomTag', isNew: true, confidence: 1.0 },
    ]);
  });

  it('shows NEW badge for new tags without publicId', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[newTag]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('NEW')).toBeInTheDocument();
  });

  it('does not show NEW badge for existing tags with publicId', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[existingTag]}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('hides manual input when disabled', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[]}
        onChange={vi.fn()}
        disabled
      />
    );
    expect(screen.queryByPlaceholderText('Add tag manually...')).not.toBeInTheDocument();
  });

  it('shows "No tags yet" when empty', () => {
    render(
      <TagSuggestionInput
        suggestedTags={[]}
        selectedTags={[]}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText('No tags yet')).toBeInTheDocument();
  });
});
