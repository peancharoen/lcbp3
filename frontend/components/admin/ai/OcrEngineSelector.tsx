// File: frontend/components/admin/ai/OcrEngineSelector.tsx
// Change Log
// - 2026-05-30: สร้าง OcrEngineSelector สำหรับดึงและสลับ OCR Engine แบบไดนามิก (T019, T020, US1)

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanText, Server, AlertCircle, CheckCircle2, Cpu } from 'lucide-react';
import { adminAiService, OcrEngineResponse } from '@/lib/services/admin-ai.service';

/** Component สำหรับเลือกและจัดการ OCR Engine ในระบบ */
export default function OcrEngineSelector() {
  const [engines, setEngines] = useState<OcrEngineResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchEngines = async () => {
    try {
      setIsLoading(true);
      const data = await adminAiService.getOcrEngines();
      setEngines(data);
    } catch (_err: unknown) {
      toast.error('ไม่สามารถดึงข้อมูล OCR Engines ได้');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEngines();
  }, []);

  const handleSelectEngine = async (engineId: string, engineName: string) => {
    try {
      setIsUpdating(engineId);
      await adminAiService.selectOcrEngine(engineId);
      toast.success(`เปลี่ยนเอนจิน OCR หลักเป็น ${engineName} สำเร็จ`);
      await fetchEngines();
    } catch (_err: unknown) {
      toast.error('ไม่สามารถเปลี่ยนเอนจิน OCR ได้');
    } finally {
      setIsUpdating(null);
    }
  };

  if (isLoading) {
    return (
      <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
        <CardHeader className="pb-3">
          <div className="h-6 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 bg-muted animate-pulse rounded" />
          <div className="h-20 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ScanText className="h-4 w-4 text-primary" />
          ระบบจัดการ OCR Engine
        </CardTitle>
        <CardDescription>
          เลือกเอนจินประมวลผลหลักสำหรับระบบสกัดเอกสารและการรัน Sandbox
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {engines.map((engine) => {
          const isTyphoon = engine.engineType === 'typhoon_ocr';
          return (
            <div
              key={engine.engineId}
              className={`relative flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border transition-all duration-300 ${
                engine.isCurrentActive
                  ? 'border-primary/50 bg-primary/5 shadow-sm'
                  : 'border-border/30 hover:border-border/60 bg-background/30'
              }`}
            >
              <div className="space-y-1.5 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{engine.engineName}</span>
                  {engine.isCurrentActive && (
                    <Badge variant="default" className="text-[10px] h-4 flex items-center gap-0.5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      กำลังใช้งาน
                    </Badge>
                  )}
                  {isTyphoon && (
                    <Badge variant="secondary" className="text-[10px] h-4 bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">
                      AI Powered
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isTyphoon
                    ? 'สกัดภาษาไทยความแม่นยำสูง (95%+) เหมาะสำหรับภาษาไทยผสมอังกฤษ'
                    : 'เอนจินมาตรฐานเบสไลน์ ประมวลผลรวดเร็วและใช้ทรัพยากรต่ำ'}
                </p>
                <div className="flex gap-4 text-[10px] text-muted-foreground flex-wrap pt-1">
                  <span className="flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    จำกัดพร้อมกัน: {engine.concurrentLimit} งาน
                  </span>
                  {isTyphoon && (
                    <>
                      <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                        <Cpu className="h-3 w-3" />
                        ต้องการ VRAM: {(engine.vramRequirementMB / 1024).toFixed(1)} GB
                      </span>
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        เอนจินสำรอง: Tesseract OCR
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 sm:mt-0 flex items-center justify-end">
                <Button
                  size="sm"
                  variant={engine.isCurrentActive ? 'secondary' : 'default'}
                  disabled={engine.isCurrentActive || isUpdating === engine.engineId}
                  onClick={() => handleSelectEngine(engine.engineId, engine.engineName)}
                  className="w-full sm:w-auto text-xs min-w-[100px]"
                >
                  {isUpdating === engine.engineId ? 'กำลังเปลี่ยน...' : engine.isCurrentActive ? 'เลือกอยู่แล้ว' : 'สลับใช้งาน'}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
