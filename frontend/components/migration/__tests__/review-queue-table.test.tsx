// File: frontend/components/migration/__tests__/review-queue-table.test.tsx
// Change Log:
// - 2026-08-31: T028 — added tests for requiresHumanReview badge, needs-review filter, OCR quality, legacy re-extract
// - 2026-05-22: Initial creation of ReviewQueueTable component tests (T024)
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewQueueTable } from '../review-queue-table';
import { MigrationReviewStatus, MigrationReviewQueueItem } from '@/types/migration';

// Mock hooks
const mockMutateAsyncCommit = vi.fn();
const mockMutateAsyncReject = vi.fn();
const mockMutateAsyncExtract = vi.fn();

vi.mock('@/hooks/use-migration-review', () => ({
  useCommitMigrationReview: () => ({
    mutateAsync: mockMutateAsyncCommit,
    isPending: false
  }),
  useRejectMigrationReview: () => ({
    mutateAsync: mockMutateAsyncReject,
    isPending: false
  }),
  useStartExtractQueueItem: () => ({
    mutateAsync: mockMutateAsyncExtract,
    isPending: false
  })
}));

vi.mock('@/hooks/use-master-data', () => ({
  useProjects: () => ({
    data: [
      { publicId: 'proj-1', projectName: 'Project A', projectCode: 'PA' }
    ]
  }),
  useOrganizations: () => ({
    data: [
      { publicId: 'org-1', organizationName: 'Org A' }
    ]
  })
}));

// Mock ResizeObserver for Radix UI
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock;

describe('ReviewQueueTable', () => {
  const mockItems: MigrationReviewQueueItem[] = [
    {
      id: 1,
      publicId: 'mig-1',
      documentNumber: 'DOC-001',
      subject: 'Test Migration Doc',
      aiSuggestedCategory: 'RFA',
      aiConfidence: 0.95,
      status: MigrationReviewStatus.PENDING_REVIEW,
      projectId: 'proj-1',
      senderOrganizationId: 'org-1',
      receiverOrganizationId: 'org-2',
      issuedDate: '2026-06-01T00:00:00.000Z',
      receivedDate: '2026-06-02T00:00:00.000Z',
      body: 'Migration test body',
      extractedTags: [{ name: 'Urgent', is_new: false }],
      aiIssues: [{ message: 'Confidence is slightly low on receiver' }],
      requiresHumanReview: true,
      ocrQualityConfidence: 0.82,
      details: {
        ocrQuality: { confidence: 0.82, issues: [] },
        metadata: {
          summary: 'Test summary',
          category: 'RFA',
          tags: [{ name: 'Urgent', isNew: false, evidence: 'text' }],
          confidence: { summary: 0.9, category: 0.85, tags: 0.8 },
        },
        fieldResolutions: {},
      },
    },
    {
      id: 2,
      publicId: 'mig-2',
      documentNumber: 'DOC-002',
      subject: 'Test Migration Doc 2',
      aiSuggestedCategory: 'Correspondence',
      aiConfidence: 0.85,
      status: MigrationReviewStatus.IMPORTED,
      requiresHumanReview: false,
      ocrQualityConfidence: 0.91,
      details: {
        ocrQuality: { confidence: 0.91, issues: [] },
        metadata: {
          summary: 'Test summary 2',
          category: 'Correspondence',
          tags: [],
          confidence: { summary: 0.92, category: 0.88, tags: 0.9 },
        },
        fieldResolutions: {},
      },
    },
    {
      id: 3,
      publicId: 'mig-3',
      documentNumber: 'DOC-003',
      subject: 'Legacy Migration Doc',
      aiSuggestedCategory: 'Correspondence',
      aiConfidence: 0.70,
      status: MigrationReviewStatus.PENDING,
      // Legacy item — details lacks metadata.confidence (pre-refactor shape)
      details: { source_file_path: '/legacy/path' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    // Mock scrollIntoView for Radix components
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('renders loading state', () => {
    render(<ReviewQueueTable items={[]} isLoading={true} />);
    expect(screen.getByText('กำลังโหลดรายการรอรีวิว...')).toBeInTheDocument();
  });

  it('renders empty state', () => {
    render(<ReviewQueueTable items={[]} isLoading={false} />);
    expect(screen.getByText('ไม่พบรายการที่รอตรวจสอบในคิวขณะนี้')).toBeInTheDocument();
  });

  it('renders queue items', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);
    expect(screen.getByText('DOC-001')).toBeInTheDocument();
    expect(screen.getByText('Test Migration Doc')).toBeInTheDocument();
    expect(screen.getByText('95.0%')).toBeInTheDocument();
    expect(screen.getByText('รอ Review OCR')).toBeInTheDocument();

    expect(screen.getByText('DOC-002')).toBeInTheDocument();
    expect(screen.getByText('Test Migration Doc 2')).toBeInTheDocument();
    expect(screen.getByText('85.0%')).toBeInTheDocument();
    expect(screen.getByText('นำเข้าแล้ว')).toBeInTheDocument();
  });

  it('opens sheet when review button is clicked', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    // First button is for 'รอตรวจสอบ' (PENDING)
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('รีวิวการย้ายข้อมูลเอกสาร')).toBeInTheDocument();
      // Should show the document number in a badge
      expect(screen.getAllByText('DOC-001').length).toBeGreaterThan(0);
      // Should show AI issues
      expect(screen.getByText('Confidence is slightly low on receiver')).toBeInTheDocument();
    });
  });

  it('allows editing subject and other fields', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /หัวข้อเรื่อง/i })).toHaveValue('Test Migration Doc');
    });

    const subjectInput = screen.getByRole('textbox', { name: /หัวข้อเรื่อง/i });
    fireEvent.change(subjectInput, { target: { value: 'Updated Subject' } });
    expect(subjectInput).toHaveValue('Updated Subject');

    const bodyInput = screen.getByRole('textbox', { name: /เนื้อหาสรุปจดหมาย/i });
    fireEvent.change(bodyInput, { target: { value: 'Updated Body' } });
    expect(bodyInput).toHaveValue('Updated Body');

    const issuedDateInput = screen.getByLabelText(/วันที่ออกเอกสาร/i);
    fireEvent.change(issuedDateInput, { target: { value: '2026-06-10' } });
    expect(issuedDateInput).toHaveValue('2026-06-10');

    const receivedDateInput = screen.getByLabelText(/วันที่ลงรับเอกสาร/i);
    fireEvent.change(receivedDateInput, { target: { value: '2026-06-11' } });
    expect(receivedDateInput).toHaveValue('2026-06-11');
  });

  it('allows adding and removing tags', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      // Urgent is already there
      expect(screen.getByText('Urgent')).toBeInTheDocument();
    });

    // Add new tag with Enter key
    const addTagInput = screen.getByPlaceholderText('เพิ่มแท็กภาษาไทย...');
    fireEvent.change(addTagInput, { target: { value: 'NewTag' } });
    fireEvent.keyDown(addTagInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('NewTag')).toBeInTheDocument();
    });

    // Add another tag with button
    fireEvent.change(addTagInput, { target: { value: 'AnotherTag' } });
    const addButton = screen.getByRole('button', { name: /เพิ่ม/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(screen.getByText('AnotherTag')).toBeInTheDocument();
    });

    // Remove Urgent tag
    // The tag badge contains 'Urgent' and an 'X' button
    const removeButtons = screen.getAllByRole('button', { name: '' });
    // The first X button inside a badge should be the one for 'Urgent' (assuming it's the only icon button without a distinct name there)
    // Actually, Lucide icon doesn't have a label by default, let's find the button by its parent
    const urgentTag = screen.getByText('Urgent');
    const removeUrgentButton = urgentTag.nextElementSibling;
    if (removeUrgentButton) {
      fireEvent.click(removeUrgentButton);
    }

    await waitFor(() => {
      expect(screen.queryByText('Urgent')).not.toBeInTheDocument();
    });
  });

  it('calls commit mutation on commit', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /กดยอมรับการนำเข้า/i })).toBeInTheDocument();
    });

    const commitButton = screen.getByRole('button', { name: /กดยอมรับการนำเข้า/i });
    fireEvent.click(commitButton);

    await waitFor(() => {
      expect(mockMutateAsyncCommit).toHaveBeenCalledWith(expect.objectContaining({
        publicId: 'mig-1',
        subject: 'Test Migration Doc',
        category: 'RFA',
        projectId: 'proj-1',
        senderId: 'org-1',
        receiverId: 'org-2',
        issuedDate: '2026-06-01',
        receivedDate: '2026-06-02',
        body: 'Migration test body',
        tags: ['Urgent'],
      }));
    });
  });

  it('calls reject mutation on reject', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ปฏิเสธการนำเข้า/i })).toBeInTheDocument();
    });

    const rejectButton = screen.getByRole('button', { name: /ปฏิเสธการนำเข้า/i });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
      expect(mockMutateAsyncReject).toHaveBeenCalledWith(1);
    });
  });

  it('closes sheet when cancel is clicked', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reviewButtons = screen.getAllByRole('button', { name: /รีวิว|ดูรายละเอียด/i });
    fireEvent.click(reviewButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ยกเลิก/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole('button', { name: /ยกเลิก/i });
    fireEvent.click(cancelButton);

    // Wait for the sheet to be removed or hidden
    await waitFor(() => {
      expect(screen.queryByText('รีวิวการย้ายข้อมูลเอกสาร')).not.toBeInTheDocument();
    });
  });

  // T028: requiresHumanReview badge + needs-review filter + OCR quality + legacy re-extract

  it('renders requiresHumanReview badge for items flagged as needing review', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);
    // mig-1 has requiresHumanReview: true → badge text from i18n key migration_review.requires_human_review_badge
    // Thai locale default: "ต้องตรวจสอบ"
    const badges = screen.getAllByText('ต้องตรวจสอบ');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('does not render requiresHumanReview badge for items not needing review', () => {
    const itemsWithoutReview: MigrationReviewQueueItem[] = [
      {
        id: 10,
        publicId: 'mig-10',
        documentNumber: 'DOC-010',
        subject: 'No Review Needed',
        aiSuggestedCategory: 'Correspondence',
        aiConfidence: 0.99,
        status: MigrationReviewStatus.PENDING_REVIEW,
        requiresHumanReview: false,
        ocrQualityConfidence: 0.95,
        details: {
          ocrQuality: { confidence: 0.95, issues: [] },
          metadata: {
            summary: 'Summary',
            category: 'Correspondence',
            tags: [],
            confidence: { summary: 0.95, category: 0.95, tags: 0.95 },
          },
          fieldResolutions: {},
        },
      },
    ];
    render(<ReviewQueueTable items={itemsWithoutReview} isLoading={false} />);
    // The "ต้องตรวจสอบ" text should NOT appear as a row badge
    // (it may appear as the filter checkbox label, so check the badge specifically)
    const reviewBadges = screen.queryAllByTestId('requires-human-review-badge');
    expect(reviewBadges).toHaveLength(0);
  });

  it('renders OCR quality confidence indicator for items with ocrQualityConfidence', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);
    // mig-1 has ocrQualityConfidence: 0.82 → "82.0%"
    expect(screen.getByText('82.0%')).toBeInTheDocument();
    // mig-2 has ocrQualityConfidence: 0.91 → "91.0%"
    expect(screen.getByText('91.0%')).toBeInTheDocument();
  });

  it('needs review filter narrows visible rows to only requiresHumanReview items', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);
    // Initially all 3 items are visible
    expect(screen.getByText('DOC-001')).toBeInTheDocument();
    expect(screen.getByText('DOC-002')).toBeInTheDocument();
    expect(screen.getByText('DOC-003')).toBeInTheDocument();

    // Click the "needs review" filter checkbox
    const filterCheckbox = screen.getByTestId('needs-review-filter');
    fireEvent.click(filterCheckbox);

    // After filter: only mig-1 (requiresHumanReview: true) should be visible
    // mig-2 (requiresHumanReview: false) and mig-3 (legacy, no flag) should be hidden
    expect(screen.getByText('DOC-001')).toBeInTheDocument();
    expect(screen.queryByText('DOC-002')).not.toBeInTheDocument();
    expect(screen.queryByText('DOC-003')).not.toBeInTheDocument();
  });

  it('renders legacy items with re-extract required state', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);
    // mig-3 is a legacy item (details lacks metadata.confidence)
    // Should show re-extract button instead of normal review button
    const reExtractButton = screen.getByTestId('re-extract-mig-3');
    expect(reExtractButton).toBeInTheDocument();
  });

  it('calls startExtractQueueItem when re-extract button is clicked', async () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    const reExtractButton = screen.getByTestId('re-extract-mig-3');
    fireEvent.click(reExtractButton);

    await waitFor(() => {
      expect(mockMutateAsyncExtract).toHaveBeenCalledWith(
        expect.objectContaining({ publicId: 'mig-3' })
      );
    });
  });

  it('sorts by OCR quality confidence when sort control is changed', () => {
    render(<ReviewQueueTable items={mockItems} isLoading={false} />);

    // Default order: DOC-001 (0.82), DOC-002 (0.91), DOC-003 (legacy)
    const rowsBefore = screen.getAllByRole('row');
    // Rows include header row, so data rows start from index 1
    // Find the document number cells in order
    const docNumbersBefore = screen.getAllByText(/DOC-00/).map((el) => el.textContent);
    expect(docNumbersBefore[0]).toBe('DOC-001');

    // Change sort to descending (highest confidence first)
    const sortSelect = screen.getByTestId('sort-ocr-quality');
    fireEvent.click(sortSelect);
    // Click the "desc" option
    const descOption = screen.getByText('สูง→ต่ำ');
    fireEvent.click(descOption);

    // After sort desc: DOC-002 (0.91) should come before DOC-001 (0.82)
    const docNumbersAfter = screen.getAllByText(/DOC-00/).map((el) => el.textContent);
    expect(docNumbersAfter[0]).toBe('DOC-002');
    expect(docNumbersAfter[1]).toBe('DOC-001');
  });
});
