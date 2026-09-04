// File: frontend/hooks/use-ai-unavailable-retry.ts
// Change Log:
// - 2026-09-04: Two-Phase Batch OCR/AI Extraction (D267) — shared Wait/Cancel retry state
//   machine for AI_FEATURES_UNAVAILABLE (503) responses. Used by useAiChat and the RAG
//   Sandbox Playground so both surfaces show the same dialog instead of a silent cold-start
//   delay or a generic error bubble.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// ระยะเวลารอระหว่างการลองใหม่แต่ละรอบ — ยาวพอที่จะไม่ spam backend ระหว่าง OCR batch phase
// (อาจกินเวลาหลายนาที) แต่สั้นพอที่ผู้ใช้จะไม่รู้สึกว่าค้าง
const RETRY_INTERVAL_MS = 8000;

export interface UseAiUnavailableRetryResult {
  /** true เมื่อควรแสดง dialog (ยังไม่ resolve และผู้ใช้ยังไม่กด cancel) */
  isDialogOpen: boolean;
  /** true ระหว่างที่กำลัง auto-retry อยู่ (หลังผู้ใช้กด "รอ") */
  isRetrying: boolean;
  /** จำนวนวินาทีที่รอมาแล้วตั้งแต่กด "รอ" — ใช้แสดง counter ใน dialog */
  elapsedSeconds: number;
  /** เรียกจาก catch block เมื่อเจอ AI_FEATURES_UNAVAILABLE — เปิด dialog พร้อมผูก retryFn ไว้ */
  trigger: (retryFn: () => Promise<void>) => void;
  /** ผู้ใช้กด "รอ" — เริ่ม retry loop ทุก 8s จนสำเร็จหรือถูก cancel */
  wait: () => void;
  /** ผู้ใช้กด "ยกเลิก" (หรือปิด dialog) — หยุด retry loop ทั้งหมด */
  cancel: () => void;
}

export function useAiUnavailableRetry(): UseAiUnavailableRetryResult {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    if (tickIntervalRef.current) clearInterval(tickIntervalRef.current);
    retryTimeoutRef.current = null;
    tickIntervalRef.current = null;
  }, []);

  // Self-referencing recursion (setTimeout เรียก attemptRetry ตัวเอง) — ปลอดภัยเพราะ setTimeout
  // callback รันหลัง render เสร็จ ตอนนั้น const attemptRetry ถูก assign แล้วแน่นอน
  const attemptRetry = useCallback(async () => {
    if (cancelledRef.current || !retryFnRef.current) return;
    try {
      await retryFnRef.current();
      // สำเร็จ — ปิด dialog และเลิกลองใหม่
      cancelledRef.current = true;
      clearTimers();
      setIsDialogOpen(false);
      setIsRetrying(false);
      retryFnRef.current = null;
    } catch {
      // ยังไม่สำเร็จ (อาจยังเป็น AI_FEATURES_UNAVAILABLE หรือ error อื่นชั่วคราว) — ลองใหม่รอบถัดไป
      if (!cancelledRef.current) {
        retryTimeoutRef.current = setTimeout(() => {
          void attemptRetry();
        }, RETRY_INTERVAL_MS);
      }
    }
     
  }, [clearTimers]);

  const trigger = useCallback((retryFn: () => Promise<void>) => {
    cancelledRef.current = false;
    retryFnRef.current = retryFn;
    setIsDialogOpen(true);
    setIsRetrying(false);
    setElapsedSeconds(0);
  }, []);

  const wait = useCallback(() => {
    setIsRetrying(true);
    setElapsedSeconds(0);
    tickIntervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    retryTimeoutRef.current = setTimeout(() => {
      void attemptRetry();
    }, RETRY_INTERVAL_MS);
  }, [attemptRetry]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    setIsDialogOpen(false);
    setIsRetrying(false);
    retryFnRef.current = null;
  }, [clearTimers]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      clearTimers();
    };
  }, [clearTimers]);

  return { isDialogOpen, isRetrying, elapsedSeconds, trigger, wait, cancel };
}
