// File: frontend/components/admin/ai/PromptEditor.tsx
// Change Log:
// - 2026-06-14: Created PromptEditor component with live placeholder validation and save actions (conforming to task T018)

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { AlertCircle, CheckCircle, Save, HelpCircle } from 'lucide-react';
import { PLACEHOLDER_REQUIREMENTS } from '@/contracts/frontend-types';

interface PromptEditorProps {
  promptType: string;
  initialTemplate: string;
  onSave: (template: string, manualNote: string) => Promise<void>;
  isSaving: boolean;
}

/**
 * คอมโพเนนต์เครื่องมือแก้ไขเทมเพลตพรอมต์ (Prompt Editor)
 * มีระบบตรวจเช็คตัวแปร/เพลสโฮลเดอร์ (Placeholder Validation) ในตัวแบบเรียลไทม์
 */
export default function PromptEditor({ promptType, initialTemplate, onSave, isSaving }: PromptEditorProps) {
  const [template, setTemplate] = useState(initialTemplate);
  const [manualNote, setManualNote] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    setTemplate(initialTemplate);
    setManualNote('');
  }, [initialTemplate, promptType]);

  // ตรวจสอบตัวแปรที่ต้องมีในพรอมต์เทมเพลต (Real-time Validation)
  useEffect(() => {
    const requirements = PLACEHOLDER_REQUIREMENTS[promptType] || [];
    const missing = requirements.filter((req) => !template.includes(req));
    setValidationErrors(missing);
  }, [template, promptType]);

  const handleSave = () => {
    if (validationErrors.length > 0) return;
    onSave(template, manualNote);
  };

  const getFriendlyTypeName = (type: string) => {
    switch (type) {
      case 'ocr_system':
        return 'คำสั่งระบบ OCR (OCR System Prompt)';
      case 'ocr_extraction':
        return 'สกัดข้อความ OCR (OCR Extraction)';
      case 'rag_query_prompt':
        return 'ค้นหาข้อมูล RAG (RAG Query)';
      case 'rag_prep_prompt':
        return 'เตรียมข้อมูล RAG (RAG Prep)';
      case 'classification_prompt':
        return 'จำแนกประเภทเอกสาร (Classification)';
      default:
        return type;
    }
  };

  return (
    <Card className="border border-border/50 bg-background/30 backdrop-blur-md transition-all duration-300 hover:shadow-md">
      <CardHeader className="border-b border-border/10 pb-3">
        <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
          แก้ไขพรอมต์เทมเพลต ({getFriendlyTypeName(promptType)})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-medium text-muted-foreground">
              โครงสร้างเทมเพลต (Template Body)
              <span title="ใส่ตัวแปรให้ตรงตามความต้องการของพรอมต์แต่ละประเภท">
                <HelpCircle className="h-3.5 w-3.5 cursor-help text-muted-foreground/60" />
              </span>
            </span>
            <span className={template.length > 4000 ? 'font-semibold text-destructive' : 'text-muted-foreground'}>
              {template.length} / 4000 อักขระ
            </span>
          </div>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="เขียนพรอมต์ของคุณที่นี่..."
            className="min-h-[250px] border-border/50 bg-background/50 font-mono text-sm focus-visible:ring-primary/30"
          />
        </div>

        {/* ระบบตรวจสอบตัวแปร (Placeholder Checklist) */}
        <div className="space-y-2.5 rounded-lg border border-border/30 bg-muted/20 p-3.5">
          <h4 className="text-xs font-semibold text-foreground">การตรวจสอบความถูกต้อง (Placeholder Verification)</h4>
          <div className="space-y-1.5">
            {(PLACEHOLDER_REQUIREMENTS[promptType] || []).map((req) => {
              const hasReq = template.includes(req);
              return (
                <div key={req} className="flex items-center gap-2 text-xs">
                  {hasReq ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 shrink-0 animate-bounce text-destructive" />
                  )}
                  <span
                    className={hasReq ? 'text-muted-foreground line-through opacity-70' : 'font-medium text-foreground'}
                  >
                    ต้องมีตัวแปร{' '}
                    <code className="rounded border border-border/30 bg-muted px-1.5 py-0.5 font-mono text-[11px] text-primary">
                      {req}
                    </code>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">บันทึกหมายเหตุรุ่น (Manual Version Note)</label>
          <Input
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            placeholder="เช่น ปรับปรุงสัดส่วนความเที่ยงตรง, เพิ่มหมวดหมู่ย่อย"
            className="border-border/50 bg-background/50 text-sm focus-visible:ring-primary/30"
          />
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-end rounded-b-xl border-t border-border/10 bg-muted/5 pt-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || validationErrors.length > 0 || template.length > 4000 || template.trim() === ''}
          className="flex items-center gap-2 bg-primary font-medium text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/95"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'กำลังบันทึก...' : 'บันทึกเวอร์ชันใหม่ (Save New Version)'}
        </Button>
      </CardFooter>
    </Card>
  );
}
