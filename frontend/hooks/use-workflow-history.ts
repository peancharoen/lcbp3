// ADR-021: Hook สำหรับดึงประวัติ Workflow พร้อมไฟล์แนบประจำ Step (US2)
import { useQuery } from '@tanstack/react-query';
import { workflowEngineService } from '@/lib/services/workflow-engine.service';
import type { WorkflowHistoryItem } from '@/types/workflow';

export const workflowHistoryKeys = {
  all: ['workflow-history'] as const,
  instance: (instanceId: string) =>
    [...workflowHistoryKeys.all, instanceId] as const,
};

/**
 * ดึงประวัติการเดินเรื่องของ Workflow Instance
 * disabled อัตโนมัติถ้า instanceId ไม่มีค่า
 */
export function useWorkflowHistory(instanceId: string | undefined) {
  return useQuery<WorkflowHistoryItem[]>({
    queryKey: workflowHistoryKeys.instance(instanceId ?? ''),
    queryFn: () => workflowEngineService.getHistory(instanceId!),
    enabled: !!instanceId,
    staleTime: 60_000, // 1 นาที — ประวัติไม่เปลี่ยนบ่อย
    retry: false,       // ถ้า 404 (endpoint ยังไม่มี) ไม่ต้อง retry
  });
}
