// File: frontend/components/rfas/__tests__/form.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for RFAForm component
// - 2026-06-13: Mock useCorrespondenceTypes and useRfaTypes to resolve preview tests failure

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RFAForm, extractArrayData, dedupeByKey, getOptionValue, getMasterOptionValue } from '../form';
import { useCreateRFA } from '@/hooks/use-rfa';
import { correspondenceService } from '@/lib/services/correspondence.service';
import { createTestQueryClient } from '@/lib/test-utils';

const renderWithClient = (ui: React.ReactElement) => {
  const { wrapper } = createTestQueryClient();
  return render(ui, { wrapper });
};



// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-rfa', () => ({
  useCreateRFA: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
}));

const mockUseDrawings = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseDisciplines = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseContracts = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseOrganizations = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseCorrespondenceTypes = vi.fn(() => ({ data: [] }));
const mockUseRfaTypes = vi.fn(() => ({ data: [] }));
const mockUseProjects = vi.fn(() => ({ data: [], isLoading: false }));
const mockUseAiStatus = vi.fn(() => ({ data: null, isLoading: false }));

vi.mock('@/hooks/use-drawing', () => ({
  useDrawings: (...args: any[]) => mockUseDrawings(...args),
}));

vi.mock('@/hooks/use-master-data', () => ({
  useDisciplines: (...args: any[]) => mockUseDisciplines(...args),
  useContracts: (...args: any[]) => mockUseContracts(...args),
  useOrganizations: (...args: any[]) => mockUseOrganizations(...args),
}));

vi.mock('@/hooks/use-reference-data', () => ({
  useCorrespondenceTypes: (...args: any[]) => mockUseCorrespondenceTypes(...args),
  useRfaTypes: (...args: any[]) => mockUseRfaTypes(...args),
}));

vi.mock('@/hooks/use-projects', () => ({
  useProjects: (...args: any[]) => mockUseProjects(...args),
}));

vi.mock('@/hooks/use-ai-status', () => ({
  useAiStatus: (...args: any[]) => mockUseAiStatus(...args),
}));

vi.mock('@/lib/services/correspondence.service', () => ({
  correspondenceService: {
    previewNumber: vi.fn(),
  },
}));

vi.mock('@/components/ai/ai-suggestion-button', () => ({
  AiSuggestionButton: () => <div data-testid="ai-suggestion-button">AI Suggestion</div>,
}));

describe('RFAForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDrawings.mockReturnValue({ data: [], isLoading: false });
    mockUseDisciplines.mockReturnValue({ data: [], isLoading: false });
    mockUseContracts.mockReturnValue({ data: [], isLoading: false });
    mockUseOrganizations.mockReturnValue({ data: [], isLoading: false });
    mockUseCorrespondenceTypes.mockReturnValue({
      data: [{ id: 1, publicId: 'uuid-rfa-type-public', typeCode: 'RFA', typeName: 'Request for Approval' }]
    });
    mockUseRfaTypes.mockReturnValue({
      data: [{ publicId: 'uuid-type', typeCode: 'SDW', typeName: 'Shop Drawing RFA' }]
    });
    mockUseProjects.mockReturnValue({ data: [], isLoading: false });
    mockUseAiStatus.mockReturnValue({ data: null, isLoading: false });
    vi.mocked(useCreateRFA).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  describe('Form Rendering', () => {
    it('should render form with all required fields', () => {
      renderWithClient(<RFAForm />);

      expect(screen.getByText('Project *')).toBeInTheDocument();
      expect(screen.getByText('Contract *')).toBeInTheDocument();
      expect(screen.getByText('Discipline *')).toBeInTheDocument();
      expect(screen.getByText('RFA Type *')).toBeInTheDocument();
      expect(screen.getByText('Subject *')).toBeInTheDocument();
      expect(screen.getByText('To Organization *')).toBeInTheDocument();
    });

    it('should render optional fields', () => {
      renderWithClient(<RFAForm />);

      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByText('Body (Content)')).toBeInTheDocument();
      expect(screen.getByText('Remarks')).toBeInTheDocument();
    });

    it('should render submit button', () => {
      renderWithClient(<RFAForm />);

      expect(screen.getByText('Create RFA')).toBeInTheDocument();
    });

    it('should render AI suggestion button', () => {
      renderWithClient(<RFAForm />);

      expect(screen.getByTestId('ai-suggestion-button')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show validation error for empty project', async () => {
      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Project is required/)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty contract', async () => {
      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Contract is required/)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty discipline', async () => {
      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Discipline is required/)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty type', async () => {
      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Type is required/)).toBeInTheDocument();
      });
    });

    it('should show validation error for short subject', async () => {
      renderWithClient(<RFAForm />);

      const subjectInput = screen.getByLabelText('Subject *');
      fireEvent.change(subjectInput, { target: { value: 'abc' } });

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Subject must be at least 5 characters/)).toBeInTheDocument();
      });
    });

    it('should show validation error for empty to organization', async () => {
      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      fireEvent.submit(submitButton.closest('form')!);

      await waitFor(() => {
        expect(screen.getByText(/Please select To Organization/)).toBeInTheDocument();
      });
    });
  });

  describe('Field Interactions', () => {
    it('should allow subject input', () => {
      renderWithClient(<RFAForm />);

      const subjectInput = screen.getByLabelText('Subject *');
      fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });

      expect(subjectInput).toHaveValue('Test Subject');
    });

    it('should allow description input', () => {
      renderWithClient(<RFAForm />);

      const descriptionInput = screen.getByLabelText('Description');
      fireEvent.change(descriptionInput, { target: { value: 'Test Description' } });

      expect(descriptionInput).toHaveValue('Test Description');
    });

    it('should allow body input', () => {
      renderWithClient(<RFAForm />);

      const bodyInput = screen.getByLabelText('Body (Content)');
      fireEvent.change(bodyInput, { target: { value: 'Test Body' } });

      expect(bodyInput).toHaveValue('Test Body');
    });

    it('should allow remarks input', () => {
      renderWithClient(<RFAForm />);

      const remarksInput = screen.getByLabelText('Remarks');
      fireEvent.change(remarksInput, { target: { value: 'Test Remarks' } });

      expect(remarksInput).toHaveValue('Test Remarks');
    });
  });

  describe('Drawing Selection', () => {
    it('should render shop drawing section', () => {
      mockUseRfaTypes.mockReturnValue({
        data: [{ publicId: 'uuid-sdw', typeCode: 'SDW', typeName: 'Shop Drawing RFA' }]
      });

      renderWithClient(<RFAForm defaultValues={{ rfaTypeId: 'uuid-sdw' }} />);
      expect(screen.getByText(/Shop Drawings/i)).toBeInTheDocument();
    });

    it('should render as-built drawing section', () => {
      mockUseRfaTypes.mockReturnValue({
        data: [{ publicId: 'uuid-adw', typeCode: 'ADW', typeName: 'As-Built Drawing RFA' }]
      });

      renderWithClient(<RFAForm defaultValues={{ rfaTypeId: 'uuid-adw' }} />);
      expect(screen.getByText(/As-Built Drawings/i)).toBeInTheDocument();
    });

    it('should show search input for shop drawings', () => {
      mockUseRfaTypes.mockReturnValue({
        data: [{ publicId: 'uuid-sdw', typeCode: 'SDW', typeName: 'Shop Drawing RFA' }]
      });

      renderWithClient(<RFAForm defaultValues={{ rfaTypeId: 'uuid-sdw' }} />);
      const searchInput = screen.getByPlaceholderText(/ค้นหาตาม Drawing Number/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('should show search input for as-built drawings', () => {
      mockUseRfaTypes.mockReturnValue({
        data: [{ publicId: 'uuid-adw', typeCode: 'ADW', typeName: 'As-Built RFA' }]
      });

      renderWithClient(<RFAForm defaultValues={{ rfaTypeId: 'uuid-adw' }} />);
      const searchInput = screen.getByPlaceholderText(/ค้นหาตาม Drawing Number/i);
      expect(searchInput).toBeInTheDocument();
    });
  });

  describe('Preview Functionality', () => {
    it('should show preview section when form is valid', async () => {
      vi.mocked(correspondenceService.previewNumber).mockResolvedValue({
        number: 'RFA-001',
        isDefaultTemplate: false,
      });

      renderWithClient(
        <RFAForm
          defaultValues={{
            projectId: 'uuid-project',
            rfaTypeId: 'uuid-type',
            disciplineId: '1',
            toOrganizationId: 'uuid-org',
            subject: 'Test Subject',
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText(/Document Number Preview/i)).toBeInTheDocument();
      });
    });

    it('should display preview number', async () => {
      vi.mocked(correspondenceService.previewNumber).mockResolvedValue({
        number: 'RFA-001',
        isDefaultTemplate: false,
      });

      renderWithClient(
        <RFAForm
          defaultValues={{
            projectId: 'uuid-project',
            rfaTypeId: 'uuid-type',
            disciplineId: '1',
            toOrganizationId: 'uuid-org',
            subject: 'Test Subject',
          }}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('RFA-001')).toBeInTheDocument();
      });
    });
  });

  describe('Submit Functionality', () => {
    it('should call create mutation on valid submit', async () => {
      const mockMutate = vi.fn();
      vi.mocked(useCreateRFA).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      expect(submitButton).toBeInTheDocument();
    });

    it('should show loading state during submission', () => {
      vi.mocked(useCreateRFA).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
      } as any);

      renderWithClient(<RFAForm />);

      const submitButton = screen.getByText('Create RFA');
      expect(submitButton).toBeDisabled();
    });
  });

  describe('Helper Functions', () => {
    it('should extract array data from nested structure', () => {
      const data = { data: { data: [1, 2, 3] } };
      const result = extractArrayData<number>(data);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return empty array for non-array data', () => {
      const data = { data: 'not an array' };
      const result = extractArrayData<number>(data);
      expect(result).toEqual([]);
    });

    it('should dedupe items by key', () => {
      const items = [
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
        { id: 1, name: 'C' },
      ];
      const result = dedupeByKey(items, (item) => item.id);
      expect(result).toHaveLength(2);
    });

    it('should get option value correctly', () => {
      expect(getOptionValue('123')).toBe('123');
      expect(getOptionValue(123)).toBe('123');
      expect(getOptionValue(undefined)).toBeUndefined();
      expect(getOptionValue(null)).toBeUndefined();
      expect(getOptionValue('')).toBeUndefined();
    });

    it('should get master option value with fallback', () => {
      expect(getMasterOptionValue({ publicId: 'uuid-1' })).toBe('uuid-1');
      expect(getMasterOptionValue({ id: 1 })).toBe('1');
      expect(getMasterOptionValue({ publicId: 'uuid-1', id: 1 })).toBe('uuid-1');
      expect(getMasterOptionValue({})).toBeUndefined();
    });
  });
});
