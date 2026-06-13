// File: frontend/components/correspondences/list.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for CorrespondenceList component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CorrespondenceList } from './list';
import { useAuthStore } from '@/lib/stores/auth-store';
import { CorrespondenceRevision } from '@/types/correspondence';

vi.mock('@/lib/stores/auth-store', () => ({
  useAuthStore: vi.fn(),
}));

describe('CorrespondenceList Component', () => {
  const mockRevisions: CorrespondenceRevision[] = [
    {
      publicId: '019505a1-7c3e-7000-8000-rev111111111',
      revisionNumber: 1,
      revisionLabel: 'A',
      subject: 'Test Subject Alpha',
      isCurrent: true,
      dueDate: '2026-06-20T00:00:00.000Z',
      createdAt: '2026-06-13T00:00:00.000Z',
      status: {
        id: 1,
        statusCode: 'DRAFT',
        statusName: 'Draft',
      },
      correspondence: {
        publicId: '019505a1-7c3e-7000-8000-corr1111111',
        correspondenceNumber: 'CORR-2026-0001',
        projectId: 1,
        isInternal: false,
        originator: {
          publicId: '019505a1-7c3e-7000-8000-org111111111',
          organizationName: 'Originator Org',
          organizationCode: 'ORG-ORIG',
        },
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
      },
    },
    {
      publicId: '019505a1-7c3e-7000-8000-rev222222222',
      revisionNumber: 2,
      revisionLabel: 'B',
      subject: 'Test Subject Beta',
      isCurrent: true,
      dueDate: '2026-06-01T00:00:00.000Z',
      createdAt: '2026-06-02T00:00:00.000Z',
      status: {
        id: 3,
        statusCode: 'IN_REVIEW',
        statusName: 'In Review',
      },
      correspondence: {
        publicId: '019505a1-7c3e-7000-8000-corr2222222',
        correspondenceNumber: 'CORR-2026-0002',
        projectId: 1,
        isInternal: false,
        originator: {
          publicId: '019505a1-7c3e-7000-8000-org111111111',
          organizationName: 'Originator Org',
          organizationCode: 'ORG-ORIG',
        },
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
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('ควรเรนเดอร์รายชื่อเอกสารและหัวตารางได้ถูกต้อง', () => {
    render(<CorrespondenceList data={mockRevisions} />);
    expect(screen.getByText('CORR-2026-0001')).toBeInTheDocument();
    expect(screen.getByText('Test Subject Alpha')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getAllByText('ORG-ORIG').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PROJ-TEST').length).toBeGreaterThan(0);
  });

  it('ควรตรวจสอบและแสดงผล Overdue เมื่อเลยกำหนดดิวเดท', () => {
    render(<CorrespondenceList data={mockRevisions} />);
    const overdueRow = screen.getByText('Test Subject Beta').closest('tr');
    expect(overdueRow).toBeInTheDocument();
    const dueDateCell = screen.getByText('01 Jun 2026');
    expect(dueDateCell).toHaveClass('text-destructive');
  });

  it('ควรแสดงปุ่มแก้ไขสำหรับผู้มีสิทธิ์ในสถานะที่แก้ไขได้', () => {
    render(<CorrespondenceList data={mockRevisions} />);
    const editButtons = screen.getAllByTitle('Edit');
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it('ควรซ่อนปุ่มแก้ไขหากผู้ใช้ไม่มีสิทธิ์แก้ไข', () => {
    vi.mocked(useAuthStore).mockReturnValue({
      user: {
        publicId: '019505a1-7c3e-7000-8000-user11111111',
        username: 'testuser',
        email: 'test@np-dms.work',
        firstName: 'Test',
        lastName: 'User',
        role: 'VIEWER',
      },
      hasPermission: () => false,
    } as any);
    render(<CorrespondenceList data={mockRevisions} />);
    expect(screen.queryByTitle('Edit')).not.toBeInTheDocument();
  });
});
