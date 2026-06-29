// File: frontend/components/numbering/__tests__/template-editor.test.tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateEditor } from '../template-editor';
import { CorrespondenceType, Discipline } from '@/types/master-data';

const mockTypes: CorrespondenceType[] = [
  { publicId: 'type1', typeCode: 'RFA', typeName: 'Request for Approval', isActive: true } as any,
  { publicId: 'type2', typeCode: 'TRN', typeName: 'Transmittal', isActive: true } as any,
];

const mockDisciplines: Discipline[] = [
  { publicId: 'disc1', disciplineCode: 'STR', codeNameEn: 'Structural', isActive: true } as any,
];

describe('TemplateEditor', () => {
  const onSave = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly for new template', () => {
    render(
      <TemplateEditor
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('New Template')).toBeInTheDocument();
    expect(screen.getByText('Project: Test Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Format *')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Save Template' })).toBeDisabled();
  });

  it('renders correctly with existing template data', () => {
    render(
      <TemplateEditor
        template={{
          formatTemplate: '{ORG}-{TYPE}-{SEQ:4}',
          correspondenceTypeId: 'type1' as any,
          disciplineId: 'disc1' as any,
          resetSequenceYearly: false,
        } as any}
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Format *')).toHaveValue('{ORG}-{TYPE}-{SEQ:4}');
    expect(screen.getByRole('button', { name: 'Save Template' })).not.toBeDisabled();
  });

  it('allows inserting variables into format', async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const formatInput = screen.getByLabelText('Template Format *');
    await user.type(formatInput, 'TEST-');
    
    // Click a variable button
    const orgButton = screen.getByRole('button', { name: '{ORG}' });
    await user.click(orgButton);
    
    expect(formatInput).toHaveValue('TEST-{ORG}');
  });

  it('updates preview when format changes', async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const formatInput = screen.getByLabelText('Template Format *');
    fireEvent.change(formatInput, { target: { value: '{PROJECT}-{SEQ:4}' } });
    
    expect(screen.getByText('LCBP3-0001')).toBeInTheDocument();
  });

  it('calls onCancel when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave with form data', async () => {
    const user = userEvent.setup();
    render(
      <TemplateEditor
        projectId={1}
        projectName="Test Project"
        correspondenceTypes={mockTypes}
        disciplines={mockDisciplines}
        onSave={onSave}
        onCancel={onCancel}
      />
    );

    const formatInput = screen.getByLabelText('Template Format *');
    fireEvent.change(formatInput, { target: { value: '{PROJECT}-{SEQ:4}' } });
    
    // We cannot easily test Radix Select interactions in jsdom without massive pointer mocking,
    // so we'll test the default values submission first.
    
    const saveButton = screen.getByRole('button', { name: 'Save Template' });
    await user.click(saveButton);
    
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 1,
      formatTemplate: '{PROJECT}-{SEQ:4}',
      resetSequenceYearly: true,
      correspondenceTypeId: null,
      disciplineId: 0,
    }));
  });
});
