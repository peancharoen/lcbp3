// File: hooks/use-import-review.ts
// Change Log:
// - 2026-09-09: Initial creation — TanStack Query hooks for 4-Layer Excel Data
//   Review Pipeline (Feature 252, ADR-052). check/confirm/cancel are one-shot
//   mutations (no polling needed — check() runs synchronously per SC-001/SC-002).
// - 2026-09-12: Async/polling pattern (ADR-008) — check() คืน sessionId ทันที
//   แล้ว useCheckImportReview poll getStatus() จนกว่าจะ READY/FAILED
//   แก้ปัญหา axios timeout 15s ไม่พอสำหรับ AI review 265+ แถว

import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { importReviewService } from '@/lib/services/import-review.service';
import { getApiErrorMessage } from '@/types/api-error';
import {
  AiReviewerProvider,
  BatchStrategy,
  ReviewTargetMode,
} from '@/types/import-review';

/** Poll interval สำหรับ async status (2 วินาที) */
const POLL_INTERVAL_MS = 2000;

/**
 * FR-001: อัปโหลดไฟล์และเริ่ม 4-Layer review (async pattern)
 * คืน sessionId ทันที — ใช้ useReviewStatus สำหรับ poll ผล
 */
export function useCheckImportReview() {
  return useMutation({
    mutationFn: (params: {
      projectPublicId: string;
      targetMode: ReviewTargetMode;
      aiProvider: AiReviewerProvider;
      batchStrategy: BatchStrategy;
      file: File;
    }): Promise<{ reviewSessionPublicId: string }> =>
      importReviewService.check(params),
    onError: (error: unknown) => {
      toast.error('ตรวจสอบไฟล์ไม่สำเร็จ', {
        description: getApiErrorMessage(error, 'เกิดข้อผิดพลาดระหว่างตรวจสอบไฟล์ Excel'),
      });
    },
  });
}

/**
 * Async pattern — poll review status จนกว่าจะ READY/FAILED (ADR-008)
 * เรียกซ้ำทุก 2 วินาที หยุดเมื่อ status === READY หรือ FAILED
 */
export function useReviewStatus(sessionId: string | null) {
  return useQuery({
    queryKey: ['import-review-status', sessionId],
    queryFn: () => importReviewService.getStatus(sessionId!),
    enabled: !!sessionId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'READY' || status === 'FAILED' || status === 'CANCELLED' || status === 'EXPIRED') {
        return false; // หยุด poll
      }
      return POLL_INTERVAL_MS;
    },
  });
}

/** FR-014~FR-017: ยืนยันนำเข้าจริง */
export function useConfirmImportReview() {
  return useMutation({
    mutationFn: (sessionId: string) => importReviewService.confirm(sessionId),
    onSuccess: (result) => {
      toast.success('ยืนยันนำเข้าข้อมูลสำเร็จ', {
        description:
          result.quarantinedCount > 0
            ? `นำเข้า ${result.enqueuedCount} แถว, กักกัน ${result.quarantinedCount} แถว`
            : `นำเข้าสำเร็จ ${result.enqueuedCount} แถว`,
      });
    },
    onError: (error: unknown) => {
      toast.error('ยืนยันนำเข้าไม่สำเร็จ', {
        description: getApiErrorMessage(error, 'เกิดข้อผิดพลาดระหว่างยืนยันนำเข้าข้อมูล'),
      });
    },
  });
}

/** FR-016: ยกเลิก session และล้าง stash ทันที */
export function useCancelImportReview() {
  return useMutation({
    mutationFn: (sessionId: string) => importReviewService.cancel(sessionId),
    onSuccess: () => {
      toast.success('ยกเลิกรายการเรียบร้อย', {
        description: 'ระบบลบไฟล์ชั่วคราวแล้ว',
      });
    },
    onError: (error: unknown) => {
      toast.error('ยกเลิกไม่สำเร็จ', {
        description: getApiErrorMessage(error, 'เกิดข้อผิดพลาดระหว่างยกเลิกรายการ'),
      });
    },
  });
}
