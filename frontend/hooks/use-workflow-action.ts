// ADR-021 T027: useWorkflowAction — hook สำหรับส่ง Approve/Reject/Return action
// สร้าง Idempotency-Key ครั้งเดียวต่อ action intent (via useState) ป้องกัน duplicate submission
'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';
import type { WorkflowTransitionWithAttachmentsDto } from '@/types/dto/workflow-engine/workflow-engine.dto';

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
    onError: (error: Error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    },
  });

  return mutation;
}
