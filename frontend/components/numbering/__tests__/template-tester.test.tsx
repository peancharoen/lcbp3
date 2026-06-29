// File: frontend/components/numbering/__tests__/template-tester.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TemplateTester } from '../template-tester';
import { numberingApi } from '@/lib/api/numbering';

vi.mock('@/lib/api/numbering', () => ({
  numberingApi: {
    previewNumber: vi.fn(),
  },
}));

vi.mock('@/hooks/use-master-data', () => ({
  useOrganizations: vi.fn(() => ({ data: [{ publicId: 'org1', organizationCode: 'ORG', organizationName: 'Org1' }] })),
  useCorrespondenceTypes: vi.fn(() => ({ data: [{ id: 1, typeCode: 'TYPE', typeName: 'Type1' }] })),
  useContracts: vi.fn(() => ({ data: [{ id: 1 }] })),
  useDisciplines: vi.fn(() => ({ data: [{ id: 1, disciplineCode: 'DISC' }] })),
}));

describe('TemplateTester', () => {
  const onOpenChange = vi.fn();
  const mockTemplate = {
    projectId: 1,
    formatTemplate: '{ORG}-{TYPE}-{SEQ:4}',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly when open', () => {
    render(<TemplateTester open={true} onOpenChange={onOpenChange} template={mockTemplate} />);
    
    expect(screen.getByText('Test Number Generation')).toBeInTheDocument();
    expect(screen.getByText('{ORG}-{TYPE}-{SEQ:4}')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate Test Number' })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<TemplateTester open={false} onOpenChange={onOpenChange} template={mockTemplate} />);
    expect(screen.queryByText('Test Number Generation')).not.toBeInTheDocument();
  });

  it('handles successful generation', async () => {
    const user = userEvent.setup();
    render(<TemplateTester open={true} onOpenChange={onOpenChange} template={mockTemplate} />);
    
    vi.mocked(numberingApi.previewNumber).mockResolvedValue({
      previewNumber: 'ORG-TYPE-0001',
      isDefault: true,
    } as any);
    
    const generateBtn = screen.getByRole('button', { name: 'Generate Test Number' });
    await user.click(generateBtn);
    
    expect(numberingApi.previewNumber).toHaveBeenCalledWith({
      projectId: 1,
      originatorOrganizationId: '0',
      recipientOrganizationId: '0',
      correspondenceTypeId: 0,
      disciplineId: 0,
      year: new Date().getFullYear(),
    });
    
    await waitFor(() => {
      expect(screen.getByText('ORG-TYPE-0001')).toBeInTheDocument();
      expect(screen.getByText('Default Template')).toBeInTheDocument();
    });
  });

  it('handles API error', async () => {
    const user = userEvent.setup();
    render(<TemplateTester open={true} onOpenChange={onOpenChange} template={mockTemplate} />);
    
    vi.mocked(numberingApi.previewNumber).mockRejectedValue(new Error('Generation failed'));
    
    const generateBtn = screen.getByRole('button', { name: 'Generate Test Number' });
    await user.click(generateBtn);
    
    await waitFor(() => {
      expect(screen.getByText('Error: Generation failed')).toBeInTheDocument();
      expect(screen.getByText('Generation Failed:')).toBeInTheDocument();
    });
  });
});
