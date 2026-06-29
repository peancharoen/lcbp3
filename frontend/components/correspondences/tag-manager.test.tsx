// File: frontend/components/correspondences/tag-manager.test.tsx
// Change Log:
// - 2026-06-13: Initial creation - test coverage for tag-manager component

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TagManager } from './tag-manager';
import { useCorrespondenceTags, useAddTag, useRemoveTag } from '@/hooks/use-correspondence';
import { useQuery } from '@tanstack/react-query';
import { masterDataService } from '@/lib/services/master-data.service';

// Mock React Query and hook implementations
vi.mock('@/hooks/use-correspondence', () => ({
  useCorrespondenceTags: vi.fn(),
  useAddTag: vi.fn(),
  useRemoveTag: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('@/lib/services/master-data.service', () => ({
  masterDataService: {
    getTags: vi.fn(),
  },
}));

describe('TagManager Component', () => {
  const correspondenceUuid = '019505a1-7c3e-7000-8000-abc123def456';
  const mockAddMutate = vi.fn();
  const mockRemoveMutate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any);

    vi.mocked(useAddTag).mockReturnValue({
      mutate: mockAddMutate,
      isPending: false,
    } as any);

    vi.mocked(useRemoveTag).mockReturnValue({
      mutate: mockRemoveMutate,
      isPending: false,
    } as any);
  });

  it('ควรแสดง loading state เมื่อกำลังโหลดข้อมูล tag', () => {
    vi.mocked(useCorrespondenceTags).mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any);

    render(<TagManager uuid={correspondenceUuid} canEdit={false} />);

    expect(screen.getByText('Loading tags...')).toBeInTheDocument();
  });

  it('ควรแสดง empty state เมื่อไม่มี tag ถูกมอบหมาย', () => {
    vi.mocked(useCorrespondenceTags).mockReturnValue({
      data: [],
      isLoading: false,
    } as any);

    render(<TagManager uuid={correspondenceUuid} canEdit={false} />);

    expect(screen.getByText('No tags assigned')).toBeInTheDocument();
  });

  it('ควรแสดงรายการ tags ของเอกสารอย่างถูกต้อง', () => {
    const mockTags = [
      { publicId: '019505a1-7c3e-7000-8000-tag111111111', tagName: 'Critical', colorCode: '#ff0000' },
      { publicId: '019505a1-7c3e-7000-8000-tag222222222', tagName: 'Draft', colorCode: 'default' },
    ];

    vi.mocked(useCorrespondenceTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);

    render(<TagManager uuid={correspondenceUuid} canEdit={false} />);

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('ควรเรียก remove mutation เมื่อคลิกปุ่มลบ tag และมีสิทธิ์แก้ไข', () => {
    const mockTags = [
      { publicId: '019505a1-7c3e-7000-8000-tag111111111', tagName: 'Critical', colorCode: '#ff0000' },
    ];

    vi.mocked(useCorrespondenceTags).mockReturnValue({
      data: mockTags,
      isLoading: false,
    } as any);

    render(<TagManager uuid={correspondenceUuid} canEdit={true} />);

    const removeBtn = screen.getAllByRole('button')[0];
    fireEvent.click(removeBtn);

    expect(mockRemoveMutate).toHaveBeenCalledWith({
      uuid: correspondenceUuid,
      tagId: '019505a1-7c3e-7000-8000-tag111111111',
    });
  });

  it('ควรเปิดส่วนเลือก tag และแสดง tag ที่พร้อมให้เพิ่มเมื่อคลิก Add Tag', async () => {
    const mockAssigned = [
      { publicId: '019505a1-7c3e-7000-8000-tag111111111', tagName: 'Critical', colorCode: '#ff0000' },
    ];
    const mockAllTags = [
      { publicId: '019505a1-7c3e-7000-8000-tag111111111', tagName: 'Critical', colorCode: '#ff0000' },
      { publicId: '019505a1-7c3e-7000-8000-tag222222222', tagName: 'Draft', colorCode: '#00ff00' },
      { publicId: '019505a1-7c3e-7000-8000-tag333333333', tagName: 'Pending Review', colorCode: '#0000ff' },
    ];

    vi.mocked(useCorrespondenceTags).mockReturnValue({
      data: mockAssigned,
      isLoading: false,
    } as any);

    vi.mocked(useQuery).mockReturnValue({
      data: mockAllTags,
      isLoading: false,
    } as any);

    render(<TagManager uuid={correspondenceUuid} canEdit={true} />);

    const addTagBtn = screen.getByText('Add Tag');
    fireEvent.click(addTagBtn);

    await waitFor(() => {
      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    // Tag 'Critical' มีอยู่แล้ว จึงไม่ควรปรากฏในส่วน list ที่พร้อมเพิ่ม
    const listButtons = screen.getAllByRole('button');
    const hasCriticalInList = listButtons.some(btn => btn.textContent === 'Critical');
    expect(hasCriticalInList).toBe(false);

    // คลิกเพื่อเพิ่ม tag 'Draft'
    const draftBtn = screen.getByText('Draft');
    fireEvent.click(draftBtn);

    expect(mockAddMutate).toHaveBeenCalledWith({
      uuid: correspondenceUuid,
      tagId: '019505a1-7c3e-7000-8000-tag222222222',
    });
  });
});
