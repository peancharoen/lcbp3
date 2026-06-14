// File: frontend/components/admin/ai/__tests__/version-history.test.tsx
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import VersionHistory from '../VersionHistory';

describe('VersionHistory', () => {
  const mockVersions = [
    {
      versionNumber: 1,
      template: 'Test template 1',
      isActive: true,
      createdAt: '2026-06-14T10:00:00Z',
      manualNote: 'เวอร์ชันแรก',
    },
  ];

  it('ควร render loading state เมื่อ isLoading=true', () => {
    render(
      <VersionHistory
        versions={[]}
        isLoading={true}
        onLoadTemplate={vi.fn()}
        onActivateVersion={vi.fn()}
        onDeleteVersion={vi.fn()}
        isActivating={false}
        isDeleting={false}
      />
    );

    expect(screen.getByText('กำลังโหลดประวัติเวอร์ชัน...')).toBeInTheDocument();
  });

  it('ควร render empty state เมื่อไม่มีเวอร์ชัน', () => {
    render(
      <VersionHistory
        versions={[]}
        isLoading={false}
        onLoadTemplate={vi.fn()}
        onActivateVersion={vi.fn()}
        onDeleteVersion={vi.fn()}
        isActivating={false}
        isDeleting={false}
      />
    );

    expect(screen.getByText('ไม่พบเวอร์ชันอื่นในระบบสำหรับประเภทนี้')).toBeInTheDocument();
  });

  it('ควร render รายการเวอร์ชัน', () => {
    render(
      <VersionHistory
        versions={mockVersions}
        isLoading={false}
        onLoadTemplate={vi.fn()}
        onActivateVersion={vi.fn()}
        onDeleteVersion={vi.fn()}
        isActivating={false}
        isDeleting={false}
      />
    );

    expect(screen.getByText('v1')).toBeInTheDocument();
  });
});
