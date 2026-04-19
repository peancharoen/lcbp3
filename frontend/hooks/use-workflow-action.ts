// ADR-021 T027: useWorkflowAction — hook สำหรับส่ง Approve/Reject/Return action
// สร้าง Idempotency-Key ครั้งเดียวต่อ action intent (via useState) ป้องกัน duplicate submission
// ADR-021 T027a (Clarify Q1+Q2): จัดการ HTTP 409 (state violation) และ 503 (Redlock fail-closed)
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';
import type { ApiErrorResponse } from '@/lib/api/client';
import type { WorkflowTransitionWithAttachmentsDto } from '@/types/dto/workflow-engine/workflow-engine.dto';

// Type guard — ตรวจสอบว่า error ที่ได้มาเป็น ApiErrorResponse (จาก parseApiError interceptor)
function isApiErrorResponse(err: unknown): err is ApiErrorResponse {
  return (
    typeof err === 'object' &&
    err !== null &&
    'error' in err &&
    typeof (err as ApiErrorResponse).error === 'object'
  );
}

export function useWorkflowAction(instanceId: string | undefined) {
  const queryClient = useQueryClient();

  // สร้าง idempotency key ครั้งแรก — reset หลัง submit สำเร็จ เพื่อป้องกัน replay
  const [idempotencyKey, setIdempotencyKey] = useState(() => uuidv4());

  const mutation = useMutation({
    mutationFn: (dto: WorkflowTransitionWithAttachmentsDto) => {
      if (!instanceId) {
        return Promise.reject(new Error('ไม่พบ Workflow Instance ID'));
      }
      return workflowEngineService.transition(instanceId, dto, idempotencyKey);
    },
    onSuccess: () => {
      // Reset key สำหรับ action ครั้งถัดไป
      setIdempotencyKey(uuidv4());

      // Invalidate ประวัติ Workflow ของ Instance นี้
      if (instanceId) {
        void queryClient.invalidateQueries({
          queryKey: ['workflow-history', instanceId],
        });
      }

      // Invalidate รายการเอกสารหลักทั้งหมด (RFA, Correspondence)
      void queryClient.invalidateQueries({ queryKey: ['rfas'] });
      void queryClient.invalidateQueries({ queryKey: ['correspondences'] });
      void queryClient.invalidateQueries({ queryKey: ['transmittals'] });
      void queryClient.invalidateQueries({ queryKey: ['circulations'] });

      toast.success('ดำเนินการเรียบร้อยแล้ว');
    },
    onError: (error: unknown) => {
      // ADR-021 T027a: แยก handler ตาม status code
      if (isApiErrorResponse(error)) {
        const { statusCode, message, recoveryActions } = error.error;

        // Clarify Q2: 503 Service Unavailable (Redlock Fail-closed)
        if (statusCode === 503) {
          toast.error('ระบบยุ่งชั่วคราว กรุณาลองใหม่อีกครั้งภายหลัง', {
            description: 'การทำรายการไม่ถูกดำเนินการ ข้อมูลของคุณปลอดภัย',
          });
          // Keep idempotencyKey unchanged — user can retry ด้วย key เดิม
          return;
        }

        // Clarify Q1: 409 Conflict (ไม่อยู่ในสถานะที่อนุญาตให้อัปโหลด)
        if (statusCode === 409) {
          toast.error(message || 'ไม่สามารถดำเนินการในสถานะนี้ได้', {
            description: recoveryActions?.[0],
          });
          return;
        }

        // 403 Forbidden — ไม่มีสิทธิ์
        if (statusCode === 403) {
          toast.error('คุณไม่มีสิทธิ์ดำเนินการในขั้นตอนนี้', {
            description: recoveryActions?.[0],
          });
          return;
        }

        // Fallback — ใช้ message จาก backend
        toast.error(message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        return;
      }

      // Fallback — plain Error (เช่น ไม่พบ instanceId)
      if (error instanceof Error) {
        toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
        return;
      }

      toast.error('เกิดข้อผิดพลาดที่ไม่คาดคิด กรุณาลองใหม่');
    },
  });

  return mutation;
}
