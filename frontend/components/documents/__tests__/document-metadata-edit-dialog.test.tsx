// File: frontend/components/documents/__tests__/document-metadata-edit-dialog.test.tsx
// Change Log:
// - 2026-09-12: Unit tests สำหรับ DocumentMetadataEditDialog (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentMetadataEditDialog, type MetadataField } from '../document-metadata-edit-dialog';
import { getDocumentActionConfig } from '../document-action-strategy';

vi.mock('@/hooks/use-translations', () => ({
  useTranslations: () => (key: string) => key,
}));

describe('DocumentMetadataEditDialog (Feature 253 — Phase 2 Frontend Unit)', () => {
  const config = getDocumentActionConfig('CORRESPONDENCE');
  const mockOnOpenChange = vi.fn();
  const mockOnConfirm = vi.fn();

  const fields: MetadataField[] = [
    { key: 'subject', label: 'Subject', value: 'Old Subject', tier: 1 },
    { key: 'originatorId', label: 'Originator', value: 'org-1', tier: 2 },
    { key: 'correspondenceNumber', label: 'Number', value: 'CORR-001', tier: 3 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('แสดง title + documentLabel + version', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.metadata.title')).toBeInTheDocument();
    expect(screen.getByText(/CORR-001/)).toBeInTheDocument();
    expect(screen.getByText(/v1/)).toBeInTheDocument();
  });

  it('แสดง tier1, tier2, tier3 sections', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('document.metadata.tier1')).toBeInTheDocument();
    expect(screen.getByText('document.metadata.tier2')).toBeInTheDocument();
    expect(screen.getByText('document.metadata.tier3')).toBeInTheDocument();
  });

  it('tier3 fields disabled (ไม่แก้ไขได้)', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    const numberInput = screen.getByDisplayValue('CORR-001');
    expect(numberInput).toBeDisabled();
  });

  it('ปุ่ม save disabled เมื่อไม่มีการเปลี่ยนแปลง', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('common.save')).toBeDisabled();
  });

  it('แก้ไข tier1 field → ปุ่ม save enabled + เรียก onConfirm ด้วย patch', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    const subjectInput = screen.getByDisplayValue('Old Subject');
    fireEvent.change(subjectInput, { target: { value: 'New Subject' } });

    const saveBtn = screen.getByText('common.save');
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);
    expect(mockOnConfirm).toHaveBeenCalledWith({ subject: 'New Subject' }, 1);
  });

  it('แก้ไข tier2 field → ต้องยืนยัน checkbox ก่อน save', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    const originatorInput = screen.getByDisplayValue('org-1');
    fireEvent.change(originatorInput, { target: { value: 'org-2' } });

    // แสดง checkbox ยืนยัน tier2
    expect(screen.getByText('document.metadata.tier2Confirm')).toBeInTheDocument();

    // ปุ่ม save ยัง disabled เพราะยังไม่ยืนยัน
    expect(screen.getByText('common.save')).toBeDisabled();

    // ยืนยัน checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // ปุ่ม save enabled
    expect(screen.getByText('common.save')).not.toBeDisabled();

    fireEvent.click(screen.getByText('common.save'));
    expect(mockOnConfirm).toHaveBeenCalledWith({ originatorId: 'org-2' }, 1);
  });

  it('isLoading=true → แสดง processing + disable ปุ่ม', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        isLoading={true}
        onConfirm={mockOnConfirm}
      />,
    );

    expect(screen.getByText('common.processing')).toBeInTheDocument();
  });

  it('ปิด dialog → reset values + tier2Confirmed', () => {
    render(
      <DocumentMetadataEditDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        config={config}
        documentLabel="CORR-001"
        currentVersion={1}
        fields={fields}
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Old Subject'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByText('common.cancel'));

    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
  });
});
