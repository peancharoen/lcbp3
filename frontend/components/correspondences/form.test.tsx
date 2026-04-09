import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { CorrespondenceForm } from './form';
import {
  useProjects,
  useOrganizations,
  useCorrespondenceTypes,
  useContracts,
  useDisciplines,
} from '@/hooks/use-master-data';
import { useCreateCorrespondence, useUpdateCorrespondence } from '@/hooks/use-correspondence';

vi.mock('@/hooks/use-master-data', () => ({
  useProjects: vi.fn(),
  useOrganizations: vi.fn(),
  useCorrespondenceTypes: vi.fn(),
  useContracts: vi.fn(),
  useDisciplines: vi.fn(),
}));

vi.mock('@/hooks/use-correspondence', () => ({
  useCreateCorrespondence: vi.fn(),
  useUpdateCorrespondence: vi.fn(),
}));

vi.mock('@/lib/api/numbering', () => ({
  numberingApi: {
    previewNumber: vi.fn().mockResolvedValue({
      previewNumber: 'CORR-PREVIEW-001',
      nextSequence: 1,
      isDefault: false,
    }),
  },
}));

type MockProject = {
  publicId: string;
  projectName: string;
  projectCode: string;
};

type MockContract = {
  publicId: string;
  contractName: string;
  contractCode: string;
};

const projects: MockProject[] = [
  { publicId: 'proj-1', projectName: 'Project A', projectCode: 'PA' },
  { publicId: 'proj-2', projectName: 'Project B', projectCode: 'PB' },
];

const contractsByProject: Record<string, MockContract[]> = {
  'proj-1': [{ publicId: 'contract-1', contractName: 'Contract A1', contractCode: 'CA1' }],
  'proj-2': [{ publicId: 'contract-2', contractName: 'Contract B1', contractCode: 'CB1' }],
};

const organizations = [
  { publicId: 'org-1', organizationName: 'Originator Org', organizationCode: 'ORG-A' },
  { publicId: 'org-2', organizationName: 'Recipient Org', organizationCode: 'ORG-B' },
  { publicId: 'org-3', organizationName: 'CC Org', organizationCode: 'ORG-C' },
];

const correspondenceTypes = [{ id: 1, typeName: 'Letter', typeCode: 'LTR' }];

const editInitialData = {
  project: { publicId: 'proj-1' },
  contract: { publicId: 'contract-1' },
  correspondenceTypeId: 1,
  disciplineId: 10,
  revisions: [
    {
      isCurrent: true,
      subject: 'Existing Subject',
      description: 'Existing Description',
      body: 'Existing Body',
      remarks: 'Existing Remarks',
      details: { importance: 'HIGH' as const },
    },
  ],
  originator: { publicId: 'org-1' },
  recipients: [
    {
      recipientType: 'TO',
      recipientOrganizationId: 'org-2',
      recipientOrganization: { publicId: 'org-2' },
    },
    {
      recipientType: 'CC',
      recipientOrganizationId: 'org-3',
      recipientOrganization: { publicId: 'org-3' },
    },
  ],
  correspondenceNumber: 'CORR-001',
};

describe('CorrespondenceForm (edit regression)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useProjects).mockReturnValue({
      data: projects,
      isLoading: false,
    } as ReturnType<typeof useProjects>);

    vi.mocked(useOrganizations).mockReturnValue({
      data: organizations,
      isLoading: false,
    } as ReturnType<typeof useOrganizations>);

    vi.mocked(useCorrespondenceTypes).mockReturnValue({
      data: correspondenceTypes,
      isLoading: false,
    } as ReturnType<typeof useCorrespondenceTypes>);

    vi.mocked(useContracts).mockImplementation((projectId?: number | string) => ({
      data: projectId && typeof projectId === 'string' ? contractsByProject[projectId] ?? [] : [],
      isLoading: false,
    }) as ReturnType<typeof useContracts>);

    vi.mocked(useDisciplines).mockImplementation((contractId?: number | string) => ({
      data:
        contractId === 'contract-1'
          ? [{ id: 10, disciplineCode: 'GEN', codeNameEn: 'General' }]
          : contractId === 'contract-2'
            ? [{ id: 20, disciplineCode: 'STR', codeNameEn: 'Structural' }]
            : [],
      isLoading: false,
    }) as ReturnType<typeof useDisciplines>);

    vi.mocked(useCreateCorrespondence).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useCreateCorrespondence>);

    vi.mocked(useUpdateCorrespondence).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as unknown as ReturnType<typeof useUpdateCorrespondence>);
  });

  it('keeps edit prefilled values after mount (no reset on initial render)', async () => {
    render(<CorrespondenceForm initialData={editInitialData} uuid="corr-uuid-1" />);

    expect(screen.getByLabelText('Subject *')).toHaveValue('Existing Subject');

    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveTextContent('Project A (PA)');
    expect(selects[1]).toHaveTextContent('Contract A1');
    expect(selects[3]).toHaveTextContent('General');

    await waitFor(() => {
      expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('Contract A1');
      expect(screen.getAllByRole('combobox')[3]).toHaveTextContent('General');
    });
  });

  it('keeps dependent fields intact after async effects (reset guard)', async () => {
    render(<CorrespondenceForm initialData={editInitialData} uuid="corr-uuid-2" />);

    expect(screen.getByLabelText('Subject *')).toHaveValue('Existing Subject');
    expect(screen.getByText('Current Document Number')).toBeInTheDocument();

    await waitFor(() => {
      const updatedSelects = screen.getAllByRole('combobox');
      expect(updatedSelects[0]).toHaveTextContent('Project A (PA)');
      expect(updatedSelects[1]).toHaveTextContent('Contract A1');
      expect(updatedSelects[3]).toHaveTextContent('General');
    });
  });
});
