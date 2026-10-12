// File: frontend/components/admin/ai/OcrEngineSelector.tsx
// Change Log
// - 2026-05-30: สร้าง OcrEngineSelector สำหรับดึงและสลับ OCR Engine แบบไดนามิก (T019, T020, US1)
// - 2026-06-17: ลบ Tesseract ออกจาก UI ตาม ADR-035 (เปลี่ยนเป็น Fast Path: PyMuPDF Text Layer)

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ScanText, Server, CheckCircle2, Cpu } from 'lucide-react';
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
      setEngines(Array.isArray(data) ? data : []);
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
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-64 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-20 animate-pulse rounded bg-muted" />
          <div className="h-20 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50 bg-background/50 backdrop-blur-md">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ScanText className="h-4 w-4 text-primary" />
          ระบบจัดการ OCR Engine
        </CardTitle>
        <CardDescription>เลือกเอนจินประมวลผลหลักสำหรับระบบสกัดเอกสารและการรัน Sandbox</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {engines.map((engine) => {
          const isAiPowered = engine.engineType === 'np_dms_ocr';
          return (
            <div
              key={engine.engineId}
              className={`relative flex flex-col justify-between rounded-lg border p-4 transition-all duration-300 sm:flex-row sm:items-center ${
                engine.isCurrentActive
                  ? 'border-primary/50 bg-primary/5 shadow-sm'
                  : 'border-border/30 bg-background/30 hover:border-border/60'
              }`}
            >
              <div className="space-y-1.5 pr-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{engine.engineName}</span>
                  {engine.isCurrentActive && (
                    <Badge variant="default" className="flex h-4 items-center gap-0.5 text-[10px]">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      กำลังใช้งาน
                    </Badge>
                  )}
                  {isAiPowered && (
                    <Badge
                      variant="secondary"
                      className="h-4 border-ai/20 bg-ai/10 text-[10px] text-ai"
                    >
                      AI Powered
                    </Badge>
                  )}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isAiPowered
                    ? 'สกัดภาษาไทยความแม่นยำสูง (95%+) เหมาะสำหรับภาษาไทยผสมอังกฤษ'
                    : 'เอนจินมาตรฐานเบสไลน์ ประมวลผลรวดเร็วและใช้ทรัพยากรต่ำ'}
                </p>
                <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Server className="h-3 w-3" />
                    จำกัดพร้อมกัน: {engine.concurrentLimit} งาน
                  </span>
                  {isAiPowered && (
                    <>
                      <span className="flex items-center gap-1 text-ai">
                        <Cpu className="h-3 w-3" />
                        ต้องการ VRAM: {(engine.vramRequirementMB / 1024).toFixed(1)} GB
                      </span>
                      <span className="flex items-center gap-1 text-success">
                        <CheckCircle2 className="h-3 w-3" />
                        Fast Path: PyMuPDF Text Layer
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end sm:mt-0">
                <Button
                  size="sm"
                  variant={engine.isCurrentActive ? 'secondary' : 'default'}
                  disabled={engine.isCurrentActive || isUpdating === engine.engineId}
                  onClick={() => handleSelectEngine(engine.engineId, engine.engineName)}
                  className="w-full min-w-[100px] text-xs sm:w-auto"
                >
                  {isUpdating === engine.engineId
                    ? 'กำลังเปลี่ยน...'
                    : engine.isCurrentActive
                      ? 'เลือกอยู่แล้ว'
                      : 'สลับใช้งาน'}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
