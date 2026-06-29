// File: frontend/components/migration/__tests__/review-queue-table.test.tsx
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReviewQueueTable } from '../review-queue-table';
import { MigrationReviewStatus } from '@/types/migration';

// Mock hooks
const mockMutateAsyncCommit = vi.fn();
const mockMutateAsyncReject = vi.fn();

vi.mock('@/hooks/use-migration-review', () => ({
  useCommitMigrationReview: () => ({
    mutateAsync: mockMutateAsyncCommit,
    isPending: false
  }),
  useRejectMigrationReview: () => ({
    mutateAsync: mockMutateAsyncReject,
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
  const mockItems: any[] = [
    {
      id: 1,
      publicId: 'mig-1',
      documentNumber: 'DOC-001',
      subject: 'Test Migration Doc',
      aiSuggestedCategory: 'RFA',
      aiConfidence: 0.95,
      status: MigrationReviewStatus.PENDING,
      projectId: 'proj-1',
      senderOrganizationId: 'org-1',
      receiverOrganizationId: 'org-2',
      issuedDate: '2026-06-01T00:00:00.000Z',
      receivedDate: '2026-06-02T00:00:00.000Z',
      body: 'Migration test body',
      extractedTags: [{ name: 'Urgent', is_new: false }],
      aiIssues: [{ message: 'Confidence is slightly low on receiver' }]
    },
    {
      id: 2,
      publicId: 'mig-2',
      documentNumber: 'DOC-002',
      subject: 'Test Migration Doc 2',
      aiSuggestedCategory: 'Correspondence',
      aiConfidence: 0.85,
      status: MigrationReviewStatus.IMPORTED,
    }
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
    expect(screen.getByText('รอตรวจสอบ')).toBeInTheDocument();

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
});
