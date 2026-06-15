// File: frontend/components/admin/ai/RuntimeParametersPanel.tsx
// Change Log:
// - 2026-06-14: Created RuntimeParametersPanel component for managing sandbox parameters (conforming to task T048)
// - 2026-06-15: Added i18n support for Runtime Parameters label (T072)

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAiService, SandboxProfileParams } from '@/lib/services/admin-ai.service';
import { toast } from 'sonner';
import { Save, RefreshCw, CheckCircle, Sliders } from 'lucide-react';
import { v7 as uuidv7 } from 'uuid';

interface RuntimeParametersPanelProps {
  onProfileChange?: (params: SandboxProfileParams) => void;
}

const PROFILE_OPTIONS = [
  { value: 'standard', label: 'มาตรฐาน (Standard)' },
  { value: 'quality', label: 'คุณภาพสูง (Quality)' },
  { value: 'interactive', label: 'โต้ตอบเร็ว (Interactive)' },
  { value: 'deep-analysis', label: 'วิเคราะห์เชิงลึก (Deep Analysis)' },
  { value: 'ocr-extract', label: 'สกัด OCR (OCR Extract)' },
];

export default function RuntimeParametersPanel({ onProfileChange }: RuntimeParametersPanelProps) {
  const { t } = useTranslation('ai');
  const [selectedProfile, setSelectedProfile] = useState<string>('standard');
  const [params, setParams] = useState<SandboxProfileParams | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);

  const fetchProfileParams = useCallback(async (profileName: string) => {
    setIsLoading(true);
    try {
      const data = await adminAiService.getSandboxProfile(profileName);
      setParams(data);
      if (onProfileChange) {
        onProfileChange(data);
      }
    } catch (_err) {
      toast.error('ไม่สามารถดึงค่าพารามิเตอร์ Sandbox ได้');
    } finally {
      setIsLoading(false);
    }
  }, [onProfileChange]);

  useEffect(() => {
    fetchProfileParams(selectedProfile);
  }, [selectedProfile, fetchProfileParams]);

  const handleSliderChange = (field: keyof SandboxProfileParams, val: number) => {
    if (!params) return;
    setParams({
      ...params,
      [field]: val,
    });
  };

  const handleInputChange = (field: keyof SandboxProfileParams, val: string) => {
    if (!params) return;
    const parsed = val === '' ? null : Number(val);
    setParams({
      ...params,
      [field]: parsed,
    });
  };

  const handleSaveDraft = async () => {
    if (!params) return;
    setIsSaving(true);
    try {
      const key = uuidv7();
      const res = await adminAiService.saveSandboxProfile(selectedProfile, params, key);
      setParams(res);
      toast.success('บันทึกแบบร่าง Sandbox สำเร็จ');
      if (onProfileChange) {
        onProfileChange(res);
      }
    } catch (_err) {
      toast.error('ไม่สามารถบันทึกแบบร่างได้');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDraft = async () => {
    setIsResetting(true);
    try {
      const res = await adminAiService.resetSandboxProfile(selectedProfile);
      setParams(res);
      toast.success('รีเซ็ตแบบร่างเป็นค่าเริ่มต้นแล้ว');
      if (onProfileChange) {
        onProfileChange(res);
      }
    } catch (_err) {
      toast.error('ไม่สามารถรีเซ็ตแบบร่างได้');
    } finally {
      setIsResetting(false);
    }
  };

  const handleApplyToProduction = async () => {
    setIsApplying(true);
    try {
      const key = uuidv7();
      await adminAiService.applyProfile(selectedProfile, key);
      toast.success('ปรับใช้พารามิเตอร์จริงสำเร็จ');
    } catch (_err) {
      toast.error('ไม่สามารถปรับใช้พารามิเตอร์จริงได้');
    } finally {
      setIsApplying(false);
    }
  };

  if (isLoading || !params) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-primary" />
        กำลังโหลดพารามิเตอร์...
      </div>
    );
  }

  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="pb-3 border-b border-border/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold tracking-wide text-foreground">
              <Sliders className="h-4 w-4 text-primary" />
              {t('sandbox_test.runtime_parameters')}
            </CardTitle>
            <CardDescription className="text-xs">
              ปรับเปลี่ยนพารามิเตอร์การทำงานของโมเดล AI ในระบบทดสอบ Sandbox
            </CardDescription>
          </div>
          <div className="w-full sm:w-[200px]">
            <Select value={selectedProfile} onValueChange={setSelectedProfile}>
              <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm h-8 text-xs">
                <SelectValue placeholder="เลือกโปรไฟล์..." />
              </SelectTrigger>
              <SelectContent>
                {PROFILE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  อุณหภูมิความสร้างสรรค์ (Temperature)
                </Label>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {params.temperature.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.05"
                value={params.temperature}
                onChange={(e) => handleSliderChange('temperature', Number(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                ค่ายิ่งสูงโมเดลยิ่งตอบอย่างอิสระและมีความคิดสร้างสรรค์ (Temperature สูงเหมาะกับการเขียน) ค่ายิ่งต่ำยิ่งมั่นใจในความถูกต้อง (Temperature ต่ำเหมาะกับการสกัดข้อความ)
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  Top-P (Nucleus Sampling)
                </Label>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {params.topP.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={params.topP}
                onChange={(e) => handleSliderChange('topP', Number(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                กำหนดขอบเขตของคำที่เป็นไปได้ในการเลือกคำถัดไป แนะนำให้ตั้งไว้ที่ 0.8 - 0.95
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  บทลงโทษคำซ้ำ (Repeat Penalty)
                </Label>
                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  {params.repeatPenalty.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={params.repeatPenalty}
                onChange={(e) => handleSliderChange('repeatPenalty', Number(e.target.value))}
                className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <p className="text-[10px] text-muted-foreground leading-normal">
                ลดโอกาสที่โมเดลจะสร้างคำที่เคยพูดไปแล้วซ้ำๆ ค่ายิ่งสูงยิ่งช่วยลดปัญหาคำซ้ำ
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="maxTokens" className="text-xs font-semibold text-foreground">
                  Max Output Tokens
                </Label>
                <Input
                  id="maxTokens"
                  type="number"
                  placeholder="เช่น 4096 (null = สูงสุด)"
                  value={params.maxTokens ?? ''}
                  onChange={(e) => handleInputChange('maxTokens', e.target.value)}
                  className="bg-background/50 border-border/50 h-8 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="numCtx" className="text-xs font-semibold text-foreground">
                  Context Window Size (Ctx Size)
                </Label>
                <Input
                  id="numCtx"
                  type="number"
                  placeholder="เช่น 8192 (null = สูงสุด)"
                  value={params.numCtx ?? ''}
                  onChange={(e) => handleInputChange('numCtx', e.target.value)}
                  className="bg-background/50 border-border/50 h-8 text-xs font-mono"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="keepAliveSeconds" className="text-xs font-semibold text-foreground">
                Keep-Alive (วินาที)
              </Label>
              <Input
                id="keepAliveSeconds"
                type="number"
                placeholder="เช่น 600 (-1 = โหลดตลอดเวลา, 0 = ยกเลิกทันที)"
                value={params.keepAliveSeconds}
                onChange={(e) => handleInputChange('keepAliveSeconds', e.target.value)}
                className="bg-background/50 border-border/50 h-8 text-xs font-mono"
              />
              <p className="text-[9px] text-muted-foreground">
                ระยะเวลาที่โมเดลจะค้างอยู่ใน VRAM หลังจากสิ้นสุดการขอข้อมูลก่อนระบบจะเคลียร์ VRAM
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                โมเดลสำหรับโปรไฟล์ (Canonical Model)
              </Label>
              <div className="font-mono text-xs font-bold text-foreground bg-secondary/35 border border-border/50 p-2 rounded flex justify-between items-center select-none">
                <span>{params.canonicalModel}</span>
                <span className="text-[10px] text-muted-foreground">ระบบเปลี่ยนให้อัตโนมัติ</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-4 border-t border-border/10">
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetDraft}
            disabled={isResetting || isSaving || isApplying}
            className="h-8 text-xs border-border/50 bg-background/50"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            รีเซ็ตแบบร่าง (Reset Draft)
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveDraft}
            disabled={isSaving || isResetting || isApplying}
            className="h-8 text-xs bg-secondary hover:bg-secondary/80 border border-border/30"
          >
            <Save className="mr-1.5 h-3.5 w-3.5 text-primary" />
            บันทึกแบบร่าง (Save Draft)
          </Button>
          <Button
            size="sm"
            onClick={handleApplyToProduction}
            disabled={isApplying || isSaving || isResetting}
            className="h-8 text-xs bg-primary hover:bg-primary/95 text-primary-foreground"
          >
            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            ปรับใช้จริง (Apply to Production)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
