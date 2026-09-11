// File: frontend/components/admin/ai/rag-console/ServiceUnavailableBanner.tsx
// Change Log:
// - 2026-09-10: T016 — สร้าง ServiceUnavailableBanner component สำหรับ Feature 255 (Q40)
// - 2026-09-10: Fix — use apiClient default import + ragAdminT helper

'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import apiClient from '@/lib/api/client';
import { ragAdminT } from './rag-admin-i18n';

/** Health status จาก GET /ai/admin/health */
interface AiSystemHealth {
  ollama: { status: 'UP' | 'DOWN' };
  qdrant: { status: 'UP' | 'DOWN' };
  ocr: { status: 'UP' | 'DOWN' };
  timestamp: string;
}

/** Banner แสดงเมื่อ AI service unavailable (Q40)
 * - Polls GET /ai/admin/health ทุก 10s
 * - แสดง banner เมื่อ Ollama, Qdrant หรือ OCR แจ้ง DOWN
 */
export function ServiceUnavailableBanner() {
  const { data: health } = useQuery({
    queryKey: ['ai-admin-health'],
    queryFn: async () => {
      const response = await apiClient.get('/ai/admin/health');
      return response.data.data as AiSystemHealth; // Unwrap NestJS Interceptor 'data' wrapper
    },
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });

  const isDown =
    health?.ollama?.status === 'DOWN' ||
    health?.qdrant?.status === 'DOWN' ||
    health?.ocr?.status === 'DOWN';

  if (!isDown) return null;

  return (
    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <p className="text-sm font-medium text-destructive">
          {ragAdminT('errors.service_unavailable')}
        </p>
      </div>
    </div>
  );
}
