// File: frontend/components/admin/ai/HostMetricsCard.tsx
// Change Log:
// - 2026-08-24: ADR-048 T008 — สร้าง HostMetricsCard แสดง CPU%, RAM%, Temp°C พร้อม SVG Sparklines

'use client';

import { useMemo } from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Cpu, MemoryStick, Thermometer, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Pause, Play, RefreshCw } from 'lucide-react';
import type { HostMetricsResponse, HostMetricsHistoryPoint } from '@/lib/services/admin-ai.service';

interface HostMetricsCardProps {
  data: HostMetricsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  isPaused: boolean;
  onTogglePause: () => void;
  onManualRefresh: () => void;
}

/** สร้าง SVG path สำหรับ Sparkline จาก array ของค่า 0-100 */
function buildSparklinePath(values: number[], width: number, height: number): string {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    const x = width / 2;
    const y = height - (values[0] / 100) * height;
    return `M ${x.toFixed(2)} ${y.toFixed(2)}`;
  }
  const stepX = width / (values.length - 1);
  return values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

interface SparklineProps {
  values: number[];
  color: string;
  label: string;
  height?: number;
}

/** SVG Sparkline mini-chart สำหรับ history data */
function Sparkline({ values, color, label, height = 40 }: SparklineProps) {
  const width = 120;
  const path = useMemo(() => buildSparklinePath(values, width, height), [values, height]);
  if (values.length === 0) {
    return (
      <div className="flex items-center justify-center text-[10px] text-muted-foreground italic" style={{ height }}>
        {label}: —
      </div>
    );
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-label={label}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle
        cx={width}
        cy={height - (Math.max(0, Math.min(100, values[values.length - 1])) / 100) * height}
        r={2}
        fill={color}
      />
    </svg>
  );
}

/** ฟอร์แมต bytes เป็นหน่วยที่อ่านง่าย */
function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

/** ดึงค่า history สำหรับ Sparkline */
function extractHistoryValues(history: HostMetricsHistoryPoint[] | undefined): {
  cpu: number[];
  memory: number[];
  temperature: number[];
} {
  if (!Array.isArray(history) || history.length === 0) {
    return { cpu: [], memory: [], temperature: [] };
  }
  return {
    cpu: history.map((p) => p.cpuPercentage),
    memory: history.map((p) => p.memoryPercentage),
    // กรอง null ออกจาก temperature เพื่อไม่ให้ sparkline แสดง dip ลง 0°C
    temperature: history
      .map((p) => p.temperatureCelsius)
      .filter((v): v is number => v !== null),
  };
}

/**
 * Card แสดงผล Host Telemetry: CPU%, RAM%, Temp°C พร้อม SVG Sparklines
 * รองรับ auto-refresh 10s และ manual refresh
 */
export function HostMetricsCard({
  data,
  isLoading,
  isError,
  isPaused,
  onTogglePause,
  onManualRefresh,
}: HostMetricsCardProps) {
  const t = useTranslations();
  const sparkData = useMemo(() => extractHistoryValues(data?.history), [data?.history]);

  return (
    <Card className="relative overflow-hidden border border-border/50 bg-background/50 backdrop-blur-md md:col-span-3">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Cpu className="h-4 w-4 text-primary" />
            {t('ai.hostMetrics.title')}
          </CardTitle>
          <span className="text-[10px] text-muted-foreground mt-0.5">{t('ai.hostMetrics.subtitle')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground hidden sm:inline">
            {isPaused ? t('ai.hostMetrics.refresh.paused') : t('ai.hostMetrics.refresh.auto')}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={onTogglePause}
            aria-label={isPaused ? t('ai.hostMetrics.refresh.play') : t('ai.hostMetrics.refresh.pause')}
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={onManualRefresh}
            aria-label={t('ai.hostMetrics.refresh.manual')}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isError ? (
          <div className="flex items-center gap-2 text-xs text-destructive py-4 justify-center">
            <AlertCircle className="h-4 w-4" />
            <span>{t('ai.hostMetrics.error')}</span>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-4">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <span className="text-xs text-muted-foreground italic">{t('ai.hostMetrics.notAvailable')}</span>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            {/* CPU */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Cpu className="h-3.5 w-3.5" />
                  {t('ai.hostMetrics.cpu')}
                </span>
                <div className="flex items-center gap-1">
                  {data.isEstimated && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 text-amber-500 border-amber-500/30">
                      {t('ai.hostMetrics.estimated')}
                    </Badge>
                  )}
                  <span className="text-sm font-semibold text-foreground">
                    {data.cpu.overallPercentage.toFixed(1)}%
                  </span>
                </div>
              </div>
              <Progress value={data.cpu.overallPercentage} className="h-2" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{data.cpu.coreCount} {t('ai.hostMetrics.cores')}</span>
                <Sparkline values={sparkData.cpu} color="#3b82f6" label={t('ai.hostMetrics.cpu')} />
              </div>
            </div>

            {/* Memory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MemoryStick className="h-3.5 w-3.5" />
                  {t('ai.hostMetrics.memory')}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {data.memory.usedPercentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={data.memory.usedPercentage} className="h-2" />
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {formatBytes(data.memory.usedBytes)} / {formatBytes(data.memory.totalBytes)}
                </span>
                <Sparkline values={sparkData.memory} color="#10b981" label={t('ai.hostMetrics.memory')} />
              </div>
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Thermometer className="h-3.5 w-3.5" />
                  {t('ai.hostMetrics.temperature')}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {data.temperature.cpuCelsius !== null
                    ? `${data.temperature.cpuCelsius.toFixed(1)}${t('ai.hostMetrics.celsius')}`
                    : t('ai.hostMetrics.notAvailable')}
                </span>
              </div>
              {data.temperature.cpuCelsius !== null && (
                <Progress
                  value={Math.min(100, (data.temperature.cpuCelsius / 90) * 100)}
                  className="h-2"
                />
              )}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  {data.temperature.sensorName ?? '—'}
                </span>
                {data.temperature.cpuCelsius !== null && (
                  <Sparkline
                    values={sparkData.temperature}
                    color="#f59e0b"
                    label={t('ai.hostMetrics.temperature')}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default HostMetricsCard;
