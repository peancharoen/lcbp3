// File: components/ai/ai-status-banner-host.tsx
// Change Log
// - 2026-05-21: เพิ่ม host สำหรับ global AI disabled banner เฉพาะผู้ใช้ที่มีสิทธิ์ AI.
'use client';

import { useEffect, useState } from 'react';
import { AiStatusBanner } from './AiStatusBanner';
import { useCurrentUserAiStatus } from '@/hooks/use-ai-status';
import { AI_FEATURES_UNAVAILABLE_EVENT } from '@/lib/api/client';

/** แสดง global banner เมื่อ AI ถูกปิดสำหรับผู้ใช้ที่มีสิทธิ์ AI */
export function AiStatusBannerHost() {
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const { data, isLoading } = useCurrentUserAiStatus();

  useEffect(() => {
    const handleAiUnavailable = () => setServiceUnavailable(true);
    window.addEventListener(AI_FEATURES_UNAVAILABLE_EVENT, handleAiUnavailable);
    return () => window.removeEventListener(AI_FEATURES_UNAVAILABLE_EVENT, handleAiUnavailable);
  }, []);

  if (isLoading || (data?.shouldShowBanner !== true && !serviceUnavailable)) return null;
  return (
    <div className="sticky top-0 z-40 border-b bg-background px-4 py-2">
      <AiStatusBanner aiEnabled={serviceUnavailable ? false : data?.aiFeaturesEnabled} />
    </div>
  );
}
