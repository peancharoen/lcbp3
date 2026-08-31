// File: hooks/use-migration-review.ts
// Change Log:
// - 2026-08-31: T031 — เพิ่ม requiresHumanReview/sortBy/sortOrder params + useStartExtractQueueItem (ADR-050)
// - 2026-05-22: Initial creation for US2 - Staging Migration Review Hooks (T023)

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { migrationService } from '@/lib/services/migration.service';
import { MigrationReviewQueueItem, MigrationReviewStatus, PaginatedResponse } from '@/types/migration';
import { CommitMigrationReviewDto } from '@/types/dto/migration/migration-review.dto';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/types/api-error';

interface WrappedData<T> {
  data?: T;
}

interface CommitMigrationReviewRequest extends CommitMigrationReviewDto {
  idempotencyKey: string;
}

const extractData = <T>(value: unknown): T => {
  let current: unknown = value;
  for (let index = 0; index < 5; index += 1) {
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return current as T;
    }
    current = (current as WrappedData<unknown>).data;
  }
  return current as T;
};

/** ADR-050: sort options สำหรับ review queue */
type SortByOcrQuality = 'ocrQualityConfidence';
type SortOrder = 'asc' | 'desc';

export const migrationReviewKeys = {
  all: ['migration-review'] as const,
  queue: (
    status?: MigrationReviewStatus,
    page?: number,
    limit?: number,
    requiresHumanReview?: boolean,
    sortBy?: string,
    sortOrder?: string,
  ) =>
    [...migrationReviewKeys.all, 'queue', status ?? 'ALL', page ?? 1, limit ?? 10, requiresHumanReview ?? false, sortBy ?? 'none', sortOrder ?? 'asc'] as const,
};

/**
 * Hook สำหรับดึงรายการใน Staging Review Queue แบบทำ Pagination และกรองตาม Status
 * ADR-050 (T031): รองรับ requiresHumanReview filter + sortBy/sortOrder params
 */
export function useMigrationReviewQueue(
  status?: MigrationReviewStatus,
  page: number = 1,
  limit: number = 10,
  requiresHumanReview?: boolean,
  sortBy?: SortByOcrQuality,
  sortOrder?: SortOrder,
) {
  return useQuery({
    queryKey: migrationReviewKeys.queue(status, page, limit, requiresHumanReview, sortBy, sortOrder),
    queryFn: async (): Promise<PaginatedResponse<MigrationReviewQueueItem>> => {
      const response = await apiClient.get('/migration/queue', {
        params: { status, page, limit, requiresHumanReview, sortBy, sortOrder },
      });
      return extractData<PaginatedResponse<MigrationReviewQueueItem>>(response.data);
    },
    placeholderData: (prev) => prev,
    staleTime: 10 * 1000,
  });
}

/**
 * Hook สำหรับยืนยันการนำเข้าข้อมูล (Execute Import / Commit) ไปยังระบบจริง
 */
export function useCommitMigrationReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ idempotencyKey, ...payload }: CommitMigrationReviewRequest) => {
      const response = await apiClient.post('/ai/migration/review', payload, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
      return extractData<{ success: boolean; message: string; correspondencePublicId: string }>(response.data);
    },
    onSuccess: () => {
      toast.success('นำเข้าเอกสารสำเร็จ', {
        description: 'เอกสารได้รับการบันทึกเข้าระบบจริงเรียบร้อยแล้ว',
      });
      void queryClient.invalidateQueries({ queryKey: migrationReviewKeys.all });
    },
    onError: (error: unknown) => {
      const errMsg = getApiErrorMessage(error, 'เกิดข้อผิดพลาดในการนำเข้าเอกสาร');
      toast.error('ไม่สามารถนำเข้าเอกสารได้', {
        description: errMsg,
      });
    },
  });
}

/**
 * Hook สำหรับปฏิเสธเอกสารใน Review Queue
 */
export function useRejectMigrationReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await apiClient.post(`/migration/queue/${id}/reject`);
      return extractData<{ message: string; id: number }>(response.data);
    },
    onSuccess: () => {
      toast.success('ปฏิเสธเอกสารเรียบร้อย', {
        description: 'สถานะเอกสารถูกตั้งค่าเป็น REJECTED',
      });
      void queryClient.invalidateQueries({ queryKey: migrationReviewKeys.all });
    },
    onError: (error: unknown) => {
      const errMsg = getApiErrorMessage(error, 'เกิดข้อผิดพลาดในการปฏิเสธเอกสาร');
      toast.error('ไม่สามารถปฏิเสธเอกสารได้', {
        description: errMsg,
      });
    },
  });
}

/**
 * ADR-050 (T034): Hook สำหรับเริ่มดึงข้อมูล OCR/AI ใหม่ของ legacy queue item
 * ใช้สำหรับ legacy items ที่ details ไม่มี metadata.confidence (pre-refactor shape)
 * เรียกผ่าน migrationService.startExtractQueueItem (POST /migration/queue/:publicId/extract)
 */
export function useStartExtractQueueItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ publicId, idempotencyKey }: { publicId: string; idempotencyKey: string }) => {
      return migrationService.startExtractQueueItem(publicId, idempotencyKey);
    },
    onSuccess: () => {
      toast.success('เริ่มดึงข้อมูลใหม่สำเร็จ', {
        description: 'ระบบกำลังประมวลผล OCR/AI ใหม่',
      });
      void queryClient.invalidateQueries({ queryKey: migrationReviewKeys.all });
    },
    onError: (error: unknown) => {
      const errMsg = getApiErrorMessage(error, 'เกิดข้อผิดพลาดในการดึงข้อมูลใหม่');
      toast.error('ไม่สามารถดึงข้อมูลใหม่ได้', {
        description: errMsg,
      });
    },
  });
}
