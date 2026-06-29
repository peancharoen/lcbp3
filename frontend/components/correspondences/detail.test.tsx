// File: frontend/components/correspondences/detail.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for CorrespondenceDetail component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CorrespondenceDetail } from './detail';
import { useSubmitCorrespondence, useProcessWorkflow, useCancelCorrespondence } from '@/hooks/use-correspondence';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Correspondence } from '@/types/correspondence';

vi.mock('@/hooks/use-correspondence', () => ({
  useSubmitCorrespondence: vi.fn(),
  useProcessWorkflow: vi.fn(),
  useCancelCorrespondence: vi.fn(),
}));

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('@/components/correspondences/tag-manager', () => ({
  TagManager: () => <div data-testid="tag-manager" />,
}));

vi.mock('@/components/correspondences/reference-selector', () => ({
  ReferenceSelector: () => <div data-testid="reference-selector" />,
}));

vi.mock('@/components/correspondences/circulation-status-card', () => ({
  CirculationStatusCard: () => <div data-testid="circulation-status-card" />,
}));

vi.mock('@/components/correspondences/revision-history', () => ({
  RevisionHistory: () => <div data-testid="revision-history" />,
}));

vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));

describe('CorrespondenceDetail Component', () => {
  const mockSubmitMutate = vi.fn();
  const mockProcessMutate = vi.fn();
  const mockCancelMutate = vi.fn();
  const mockCorrespondence: Correspondence = {
    publicId: '019505a1-7c3e-7000-8000-abc123def456',
    correspondenceNumber: 'CORR-2026-0001',
    projectId: 1,
    correspondenceTypeId: 1,
    isInternal: false,
    createdAt: '2026-06-13T00:00:00.000Z',
    originator: {
      publicId: '019505a1-7c3e-7000-8000-org111111111',
      organizationName: 'Originator Org',
      organizationCode: 'ORG-ORIG',
    },
    recipients: [
      {
        correspondenceId: 1,
        recipientOrganizationId: 1,
        recipientType: 'TO',
        recipientOrganization: {
          publicId: '019505a1-7c3e-7000-8000-org222222222',
          organizationName: 'Recipient Org',
          organizationCode: 'ORG-REC',
        },
      },
      {
        correspondenceId: 1,
        recipientOrganizationId: 2,
        recipientType: 'CC',
        recipientOrganization: {
          publicId: '019505a1-7c3e-7000-8000-org333333333',
          organizationName: 'CC Org',
          organizationCode: 'ORG-CC',
        },
      },
    ],
    project: {
      publicId: '019505a1-7c3e-7000-8000-proj11111111',
      projectName: 'Test Project',
      projectCode: 'PROJ-TEST',
    },
    type: {
      id: 1,
      typeName: 'Letter',
      typeCode: 'LTR',
    },
    revisions: [
      {
        publicId: '019505a1-7c3e-7000-8000-rev111111111',
        revisionNumber: 1,
        revisionLabel: 'A',
        subject: 'Test Subject',
        description: 'Test Description',
        body: 'Test Body Content',
        remarks: 'Test Remarks',
        isCurrent: true,
        status: {
          id: 1,
          statusCode: 'DRAFT',
          statusName: 'Draft',
        },
        details: {
          importance: 'NORMAL',
        },
        documentDate: '2026-06-13T00:00:00.000Z',
        dueDate: '2026-06-20T00:00:00.000Z',
        issuedDate: '2026-06-13T00:00:00.000Z',
        receivedDate: '2026-06-13T00:00:00.000Z',
        createdAt: '2026-06-13T00:00:00.000Z',
        correspondence: {} as any,
        attachmentLinks: [
          {
            isMainDocument: true,
            attachment: {
              publicId: '019505a1-7c3e-7000-8000-file1111111',
              originalFilename: 'test-file.pdf',
              filePath: '/uploads/test-file.pdf',
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubmitCorrespondence).mockReturnValue({
      mutate: mockSubmitMutate,
      isPending: false,
    } as any);
    vi.mocked(useProcessWorkflow).mockReturnValue({
      mutate: mockProcessMutate,
      isPending: false,
    } as any);
    vi.mocked(useCancelCorrespondence).mockReturnValue({
      mutate: mockCancelMutate,
      isPending: false,
    } as any);
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        publicId: '019505a1-7c3e-7000-8000-user11111111',
        username: 'testuser',
        email: 'test@np-dms.work',
        firstName: 'Test',
        lastName: 'User',
        role: 'ADMIN',
      },
      hasPermission: () => true,
    } as any);
  });

  it('ควรเรนเดอร์รายละเอียดเอกสารและข้อมูลพื้นฐานได้ถูกต้อง', () => {
    render(<CorrespondenceDetail data={mockCorrespondence} />);
    expect(screen.getByText('CORR-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Test Subject')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
    expect(screen.getByText('Test Body Content')).toBeInTheDocument();
    expect(screen.getByText('Test Remarks')).toBeInTheDocument();
    expect(screen.getByText('Originator Org')).toBeInTheDocument();
    expect(screen.getByText('Recipient Org')).toBeInTheDocument();
    expect(screen.getByText('ORG-CC')).toBeInTheDocument();
    expect(screen.getByText('test-file.pdf')).toBeInTheDocument();
  });

  it('ควรแสดงปุ่มและส่งคำขอเมื่อกด Submit for Review ในกรณีที่เป็น DRAFT', () => {
    render(<CorrespondenceDetail data={mockCorrespondence} />);
    const submitBtn = screen.getByRole('button', { name: 'Submit for Review' });
    fireEvent.click(submitBtn);
    expect(mockSubmitMutate).toHaveBeenCalledWith({
      uuid: '019505a1-7c3e-7000-8000-abc123def456',
      data: {},
    });
  });

  it('ควรแสดงข้อความเตือนภัยและซ่อนปุ่มการกระทำบางอย่างหากเอกสารถูกยกเลิก', () => {
    const cancelledCorrespondence = {
      ...mockCorrespondence,
      revisions: [
        {
          ...mockCorrespondence.revisions![0],
          status: { id: 2, statusCode: 'CANCELLED', statusName: 'Cancelled' },
        },
      ],
    };
    render(<CorrespondenceDetail data={cancelledCorrespondence} />);
    expect(screen.getByText('This correspondence has been cancelled')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit for Review' })).not.toBeInTheDocument();
  });

  it('ควรแสดงปุ่ม Approve และ Reject ในกรณีที่เอกสารเป็น IN_REVIEW', () => {
    const inReviewCorrespondence = {
      ...mockCorrespondence,
      revisions: [
        {
          ...mockCorrespondence.revisions![0],
          status: { id: 3, statusCode: 'IN_REVIEW', statusName: 'In Review' },
        },
      ],
    };
    render(<CorrespondenceDetail data={inReviewCorrespondence} />);
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument();
  });

  it('ควรเปิดการกดยืนยันการอนุมัติและส่งความคิดเห็นได้ถูกต้อง', async () => {
    const inReviewCorrespondence = {
      ...mockCorrespondence,
      revisions: [
        {
          ...mockCorrespondence.revisions![0],
          status: { id: 3, statusCode: 'IN_REVIEW', statusName: 'In Review' },
        },
      ],
    };
    render(<CorrespondenceDetail data={inReviewCorrespondence} />);
    const approveBtn = screen.getByRole('button', { name: 'Approve' });
    fireEvent.click(approveBtn);
    expect(screen.getByText('Confirm Approval')).toBeInTheDocument();
    const commentInput = screen.getByPlaceholderText('Enter comments...');
    fireEvent.change(commentInput, { target: { value: 'Approved comment' } });
    const confirmBtn = screen.getByRole('button', { name: 'Confirm Approve' });
    fireEvent.click(confirmBtn);
    expect(mockProcessMutate).toHaveBeenCalledWith(
      {
        uuid: '019505a1-7c3e-7000-8000-abc123def456',
        data: { action: 'APPROVE', comments: 'Approved comment' },
      },
      expect.any(Object)
    );
  });

  it('ควรเปิดส่วนยกเลิกเอกสารและส่งเหตุผลการยกเลิกได้ถูกต้อง', () => {
    render(<CorrespondenceDetail data={mockCorrespondence} />);
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(screen.getByText('Cancel Correspondence')).toBeInTheDocument();
    const reasonInput = screen.getByPlaceholderText('Enter reason for cancellation...');
    fireEvent.change(reasonInput, { target: { value: 'Test cancellation reason' } });
    const confirmCancelBtn = screen.getByRole('button', { name: 'Confirm Cancellation' });
    fireEvent.click(confirmCancelBtn);
    expect(mockCancelMutate).toHaveBeenCalledWith(
      {
        uuid: '019505a1-7c3e-7000-8000-abc123def456',
        reason: 'Test cancellation reason',
      },
      expect.any(Object)
    );
  });

  it('ควรเรนเดอร์เวอร์ชันที่เลือกแบบเฉพาะเจาะจงเมื่อส่ง parameter selectedRevisionId มา', () => {
    const multiRevCorrespondence = {
      ...mockCorrespondence,
      revisions: [
        {
          ...mockCorrespondence.revisions![0],
          publicId: '019505a1-7c3e-7000-8000-rev111111111',
          subject: 'Revision A Subject',
          isCurrent: false,
        },
        {
          ...mockCorrespondence.revisions![0],
          publicId: '019505a1-7c3e-7000-8000-rev222222222',
          subject: 'Revision B Subject',
          isCurrent: true,
        },
      ],
    };
    render(
      <CorrespondenceDetail
        data={multiRevCorrespondence}
        selectedRevisionId="019505a1-7c3e-7000-8000-rev111111111"
      />
    );
    expect(screen.getByText('Revision A Subject')).toBeInTheDocument();
    expect(screen.queryByText('Revision B Subject')).not.toBeInTheDocument();
  });
});
