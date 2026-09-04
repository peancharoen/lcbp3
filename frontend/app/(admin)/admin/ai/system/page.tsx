// File: frontend/app/(admin)/admin/ai/system/page.tsx
// Change Log:
// - 2026-08-02: แยก System Toggle ออกจาก AI Console page หลัก
// - 2026-09-04: relabel "Active Models" → "Configured Models" — health.activeModels คือชื่อ
//   model ที่ config ไว้ (env) ไม่ใช่สถานะโหลดจริงใน GPU ขณะนี้ (ดู CombinedOllamaEngineCard
//   สำหรับสถานะจริงจาก vramStatus.loadedModels)

'use client';

import { Loader2, Power, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useAiStatus, useToggleAiFeatures, useAiHealth } from '@/hooks/use-ai-status';
import { toCanonicalModel } from '@/components/admin/ai/ai-constants';

/**
 * หน้า System Toggle — เปิด/ปิด AI features สำหรับผู้ใช้ทั่วไป
 */
export default function SystemTogglePage() {
  const { data, isLoading, isError } = useAiStatus();
  const { data: health, isLoading: isHealthLoading } = useAiHealth();
  const toggleMutation = useToggleAiFeatures();
  const aiEnabled = data?.aiFeaturesEnabled ?? false;
  const busy = isLoading || toggleMutation.isPending;

  const handleToggle = async (enabled: boolean): Promise<void> => {
    await toggleMutation.mutateAsync(enabled);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Power className="h-5 w-5" />
            System Toggle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="text-base font-medium">
                {aiEnabled ? 'AI พร้อมให้ผู้ใช้ทั่วไปใช้งาน' : 'AI ถูกปิดสำหรับผู้ใช้ทั่วไป'}
              </div>
              <div className="text-sm text-muted-foreground">
                Superadmin ยังสามารถเข้าถึงส่วนทดสอบและดูแลระบบได้ตามสิทธิ์
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1 flex-wrap">
                <span>Configured Models:</span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-primary/20 text-primary bg-primary/5 font-semibold"
                >
                  {isHealthLoading ? 'Loading...' : toCanonicalModel(health?.activeModels?.main ?? 'np-dms-ai')}
                </Badge>
                <span className="text-muted-foreground/50">+</span>
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 border-purple-500/20 text-purple-600 dark:text-purple-400 bg-purple-500/5 font-semibold"
                >
                  {isHealthLoading ? 'Loading...' : toCanonicalModel(health?.activeModels?.ocr ?? 'np-dms-ocr')}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                checked={aiEnabled}
                disabled={busy || isError}
                aria-label="Toggle AI features"
                onCheckedChange={handleToggle}
              />
            </div>
          </div>
          {isError && (
            <div className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              ไม่สามารถโหลดสถานะ AI ได้ กรุณาลองใหม่อีกครั้ง
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5" />
              Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            เมื่อปิด AI ระบบจะบล็อก AI inference endpoints สำหรับผู้ใช้ทั่วไปด้วย HTTP 503
            และให้ผู้ใช้กรอกข้อมูลเองชั่วคราว
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Polling</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            อัปเดตสถานะทุก 30 วินาที (กด Refresh ในส่วน Monitoring ด้านบนเพื่อรีเฟรชทันที)
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
