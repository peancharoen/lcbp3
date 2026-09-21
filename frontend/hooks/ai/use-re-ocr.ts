// File: hooks/ai/use-re-ocr.ts
// Change Log:
// - 2026-09-19: ADR-055 T023 — TanStack Query hooks สำหรับ Attachment Manual Re-OCR
// - 2026-09-19: ADR-055 extension (D19/D22) — useAttachmentLinks + useReOcrReplaceTrigger
// - 2026-09-19: security-audit fix — useReOcrReplaceConfirm (route แยก dual permission)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reOcrService } from '@/lib/services/re-ocr.service';
import type {
  AttachmentLink,
  ReOcrEngine,
  ReOcrReplaceRequest,
  ReOcrStatusResponse,
} from '@/lib/services/re-ocr.service';

/** poll ทุก 3 วินาที (ADR-055 D14) */
export const RE_OCR_POLL_INTERVAL_MS = 3000;

const reOcrKey = (attachmentPublicId: string) => ['re-ocr', attachmentPublicId] as const;

/** สร้าง Idempotency-Key ใหม่ต่อการกด 1 ครั้ง */
const newIdempotencyKey = (prefix: string, id: string): string =>
  `${prefix}-${id}-${crypto.randomUUID()}`;

/**
 * อ่านสถานะ re-OCR — คืน null เมื่อไม่มี job; poll เฉพาะตอน queued/processing
 * (หยุด poll เมื่อเจอ terminal state เพื่อดึง newText หนัก ๆ ครั้งเดียว)
 */
export function useReOcrStatus(attachmentPublicId: string | null, enabled: boolean) {
  return useQuery<ReOcrStatusResponse | null>({
    queryKey: reOcrKey(attachmentPublicId ?? ''),
    queryFn: () => reOcrService.getStatus(attachmentPublicId as string),
    enabled: enabled && !!attachmentPublicId,
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'queued' || status === 'processing' ? RE_OCR_POLL_INTERVAL_MS : false;
    },
  });
}

/** เริ่ม re-OCR ด้วย engine ที่เลือก */
export function useReOcrTrigger(attachmentPublicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (engineType: ReOcrEngine) =>
      reOcrService.trigger(
        attachmentPublicId,
        engineType,
        newIdempotencyKey('re-ocr-trigger', attachmentPublicId)
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reOcrKey(attachmentPublicId) });
    },
  });
}

/** link ทั้งหมดของ attachment — สำหรับ link picker ของ replace flow (D22) */
export function useAttachmentLinks(attachmentPublicId: string | null, enabled: boolean) {
  return useQuery<AttachmentLink[]>({
    queryKey: ['re-ocr-links', attachmentPublicId ?? ''],
    queryFn: () => reOcrService.listLinks(attachmentPublicId as string),
    enabled: enabled && !!attachmentPublicId,
    staleTime: 30_000,
    retry: false,
  });
}

/** เริ่ม re-OCR แบบ replace — candidate file → เทียบ → confirm เพื่อ swap junction (D17–D20) */
export function useReOcrReplaceTrigger(attachmentPublicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReOcrReplaceRequest) =>
      reOcrService.triggerReplace(
        attachmentPublicId,
        body,
        newIdempotencyKey('re-ocr-replace', attachmentPublicId)
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reOcrKey(attachmentPublicId) });
    },
  });
}

/** ยืนยันแทนที่ ocr_text — สำเร็จแล้ว refresh list (RagStatusBadge/GenerationTimeline แสดง re-index เอง) */
export function useReOcrConfirm(attachmentPublicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reOcrToken: string) =>
      reOcrService.confirm(
        attachmentPublicId,
        reOcrToken,
        newIdempotencyKey('re-ocr-confirm', attachmentPublicId)
      ),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: reOcrKey(attachmentPublicId) });
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'attachments'] });
      void queryClient.invalidateQueries({
        queryKey: ['rag-admin', 'generations', attachmentPublicId],
      });
    },
  });
}

/**
 * ยืนยันแทนที่ของ replace mode (junction swap) — route แยกเพราะต้องการ
 * rag.admin.write + correspondence.edit (D19); ใช้เฉพาะ job ที่ status.mode === 'replace'
 */
export function useReOcrReplaceConfirm(attachmentPublicId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reOcrToken: string) =>
      reOcrService.confirmReplace(
        attachmentPublicId,
        reOcrToken,
        newIdempotencyKey('re-ocr-replace-confirm', attachmentPublicId)
      ),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: reOcrKey(attachmentPublicId) });
      void queryClient.invalidateQueries({ queryKey: ['re-ocr-links'] });
      void queryClient.invalidateQueries({ queryKey: ['rag-admin', 'attachments'] });
      void queryClient.invalidateQueries({
        queryKey: ['rag-admin', 'generations', attachmentPublicId],
      });
      void queryClient.invalidateQueries({ queryKey: ['correspondence'] });
    },
  });
}
