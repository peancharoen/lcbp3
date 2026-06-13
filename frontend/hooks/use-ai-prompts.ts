// File: frontend/hooks/use-ai-prompts.ts
// Change Log
// - 2026-05-25: Created useAiPrompts unified hook for React Query prompt operations (ADR-029)
// - 2026-05-25: Added useSandboxRun hook to encapsulate submit + polling logic (Obs #2 fix)
// - 2026-06-13: US4 — อัปเดต submit ใน useSandboxRun ให้สอดคล้องกับ API signature ใหม่


import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aiPromptsService } from '@/lib/services/ai-prompts.service';
import { adminAiService, AiSandboxJobResult } from '@/lib/services/admin-ai.service';

/** สถานะการรัน OCR Sandbox */
export interface SandboxRunState {
  /** กำลังอัปโหลดหรือ polling อยู่ */
  isRunning: boolean;
  /** ความคืบหน้า 0-100 */
  progress: number;
  /** ข้อความสถานะที่แสดงต่อผู้ใช้ */
  statusText: string;
  /** ผลลัพธ์สุดท้ายจาก job (null ก่อนเสร็จสิ้น) */
  result: AiSandboxJobResult | null;
}

/**
 * Unified hook สำหรับการจัดการประวัติและการเปิดใช้งาน Prompt Versions ผ่าน React Query
 */
export function useAiPrompts(promptType: string) {
  const queryClient = useQueryClient();
  const queryKey = ['ai', 'prompts', promptType] as const;
  const versionsQuery = useQuery({
    queryKey,
    queryFn: () => aiPromptsService.listVersions(promptType),
    enabled: !!promptType,
  });
  const createMutation = useMutation({
    mutationFn: (template: string) => aiPromptsService.createVersion(promptType, template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
  const activateMutation = useMutation({
    mutationFn: (versionNumber: number) =>
      aiPromptsService.activateVersion(promptType, versionNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (versionNumber: number) =>
      aiPromptsService.deleteVersion(promptType, versionNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
  const updateNoteMutation = useMutation({
    mutationFn: ({ versionNumber, note }: { versionNumber: number; note: string | null }) =>
      aiPromptsService.updateNote(promptType, versionNumber, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
  return {
    versionsQuery,
    createMutation,
    activateMutation,
    deleteMutation,
    updateNoteMutation,
  };
}

/**
 * Hook แยกสำหรับการส่ง OCR Sandbox job และ polling ผลลัพธ์
 * ให้ใช้แทนการเขียน polling logic โดยตรงในหน้า Component
 */
export function useSandboxRun(onCompleted?: () => void) {
  const [state, setState] = useState<SandboxRunState>({
    isRunning: false,
    progress: 0,
    statusText: '',
    result: null,
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // หยุด polling เมื่อ unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);
  // เริ่ม polling เมื่อมี jobId
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const res = await adminAiService.getSandboxJobStatus(jobId);
        setState((prev) => ({ ...prev, result: res }));
        if (res.status === 'pending') {
          setState((prev) => ({ ...prev, progress: 30, statusText: 'ai.prompt.statusPending' }));
        } else if (res.status === 'processing') {
          setState((prev) => ({
            ...prev,
            progress: 70,
            statusText: 'ai.prompt.statusProcessing',
          }));
        } else if (res.status === 'completed') {
          if (timerRef.current) clearInterval(timerRef.current);
          setJobId(null);
          setState((prev) => ({
            ...prev,
            isRunning: false,
            progress: 100,
            statusText: 'ai.prompt.statusCompleted',
          }));
          onCompleted?.();
        } else if (res.status === 'failed') {
          if (timerRef.current) clearInterval(timerRef.current);
          setJobId(null);
          setState((prev) => ({
            ...prev,
            isRunning: false,
            progress: 100,
            statusText: 'ai.prompt.statusFailed',
          }));
        } else if (res.status === 'cancelled') {
          if (timerRef.current) clearInterval(timerRef.current);
          setJobId(null);
          setState((prev) => ({
            ...prev,
            isRunning: false,
            progress: 100,
            statusText: 'ai.prompt.statusCancelled',
          }));
        }
      } catch {
        // เงียบข้อผิดพลาดระหว่าง polling
      }
    };
    poll();
    timerRef.current = setInterval(poll, 4000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobId, onCompleted]);
  /**
   * ส่ง PDF file เข้า sandbox queue และเริ่ม polling อัตโนมัติ
   * @returns requestPublicId หรือ throw Error เมื่อล้มเหลว
   */
  const submit = useCallback(async (file: File, projectPublicId: string, contractPublicId?: string): Promise<string> => {
    setState({
      isRunning: true,
      progress: 10,
      statusText: 'ai.prompt.uploading',
      result: null,
    });
    const response = await adminAiService.submitSandboxExtract(file, projectPublicId, contractPublicId);
    setJobId(response.requestPublicId);
    return response.requestPublicId;
  }, []);
  /**
   * เริ่ม polling สำหรับ jobId ที่มีอยู่แล้ว (สำหรับ 2-step flow)
   * @param jobId - requestPublicId ของ job ที่ submit ไปแล้ว
   */
  const startPolling = useCallback((jobIdParam: string) => {
    setState({
      isRunning: true,
      progress: 30,
      statusText: 'ai.prompt.statusPending',
      result: null,
    });
    setJobId(jobIdParam);
  }, []);
  /** รีเซ็ตสถานะทั้งหมด (ใช้ก่อนรันใหม่) */
  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setJobId(null);
    setState({ isRunning: false, progress: 0, statusText: '', result: null });
  }, []);
  return { state, jobId, submit, reset, startPolling };
}
