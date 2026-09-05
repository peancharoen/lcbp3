// File: frontend/hooks/use-cold-start-hint.ts
// Change Log:
// - 2026-09-05: ADR-051 D2 — hook ตรวจจับ cold-start ของ Ollama ด้วย response time
//   (ตามที่ ADR อนุญาต: "ตรวจจับผ่าน response time หรือ Ollama /api/ps") —
//   คืน true เมื่อ realtime AI request รอนานเกิน delayMs ต่อเนื่อง เพื่อให้ UI
//   เปลี่ยนจาก spinner เฉยๆ เป็นข้อความอธิบายว่าระบบกำลังเตรียมโมเดล

'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * ตรวจจับว่า request ที่กำลังรออยู่ "น่าจะ" เป็น Ollama cold-start หรือไม่
 * โดยวัดจากเวลาที่รอต่อเนื่องเกิน delayMs (ADR-051 D2 — elapsed-time heuristic)
 *
 * @param isWaiting true ขณะที่ request/job ยังไม่เสร็จ
 * @param delayMs ระยะเวลารอก่อนถือว่าน่าจะ cold-start (default 5000ms)
 * @returns true เมื่อรอนานเกิน threshold — ใช้สลับข้อความ loading เป็นคำอธิบาย cold-start
 */
export function useColdStartHint(isWaiting: boolean, delayMs = 5000): boolean {
  const [isColdStartLikely, setIsColdStartLikely] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isWaiting) {
      timerRef.current = setTimeout(() => {
        setIsColdStartLikely(true);
      }, delayMs);
    } else {
      setIsColdStartLikely(false);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isWaiting, delayMs]);
  return isColdStartLikely;
}
