// File: components/ai/AiStatusBanner.tsx
// Change Log
// - 2026-05-14: เพิ่ม banner สำหรับ graceful degradation ของ AI staging.
// - 2026-05-21: รองรับ global banner เมื่อ Superadmin ปิด AI features.
'use client';

import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTranslations } from '@/hooks/use-translations';

interface AiStatusBannerProps {
  isOffline?: boolean;
  aiEnabled?: boolean;
  queuePaused?: boolean;
}

export function AiStatusBanner({ isOffline = false, aiEnabled = true, queuePaused = false }: AiStatusBannerProps) {
  const t = useTranslations();

  if (isOffline || !aiEnabled) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('ai.status.offlineTitle')}</AlertTitle>
        <AlertDescription>{t('ai.status.disabledDescription')}</AlertDescription>
      </Alert>
    );
  }

  if (queuePaused) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{t('ai.status.queue-paused')}</AlertTitle>
        <AlertDescription>{t('ai.status.queuePausedDescription')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <CheckCircle2 className="h-4 w-4" />
      <AlertTitle>{t('ai.status.onlineTitle')}</AlertTitle>
      <AlertDescription>{t('ai.status.onlineDescription')}</AlertDescription>
    </Alert>
  );
}
