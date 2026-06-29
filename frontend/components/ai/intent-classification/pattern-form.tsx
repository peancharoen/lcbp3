'use client';

// File: components/ai/intent-classification/pattern-form.tsx
// Change Log
// - 2026-05-19: สร้าง Pattern Form (Create/Update) (ADR-024).

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type {
  IntentPattern,
  PatternType,
  PatternLanguage,
} from '@/lib/services/ai-intent.service';

interface PatternFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    patternType: PatternType;
    patternValue: string;
    language?: PatternLanguage;
    priority?: number;
  }) => void;
  /** ถ้ามี = edit mode */
  initial?: IntentPattern;
  isLoading?: boolean;
}

/**
 * Dialog Form สำหรับสร้าง/แก้ไข Intent Pattern
 */
export function PatternForm({
  open,
  onClose,
  onSubmit,
  initial,
  isLoading,
}: PatternFormProps) {
  const isEdit = !!initial;
  const [patternType, setPatternType] = useState<PatternType>(
    initial?.patternType || 'keyword'
  );
  const [patternValue, setPatternValue] = useState(initial?.patternValue || '');
  const [language, setLanguage] = useState<PatternLanguage>(
    initial?.language || 'any'
  );
  const [priority, setPriority] = useState<number>(initial?.priority || 100);
  const [regexError, setRegexError] = useState<string | null>(null);

  /** Validate regex ใน frontend ก่อนส่ง */
  const validateRegex = (value: string): boolean => {
    if (patternType !== 'regex') return true;
    try {
      new RegExp(value);
      setRegexError(null);
      return true;
    } catch (err) {
      setRegexError(err instanceof Error ? err.message : 'Invalid regex');
      return false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegex(patternValue)) return;
    onSubmit({ patternType, patternValue, language, priority });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'แก้ไข Pattern' : 'เพิ่ม Pattern ใหม่'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Pattern Type */}
          <div className="space-y-1">
            <Label>ชนิด Pattern</Label>
            <Select
              value={patternType}
              onValueChange={(v) => {
                setPatternType(v as PatternType);
                setRegexError(null);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Keyword (includes)</SelectItem>
                <SelectItem value="regex">Regex (RegExp)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pattern Value */}
          <div className="space-y-1">
            <Label htmlFor="patternValue">
              ค่า Pattern {patternType === 'regex' && '(Regular Expression)'}
            </Label>
            <Input
              id="patternValue"
              value={patternValue}
              onChange={(e) => {
                setPatternValue(e.target.value);
                if (patternType === 'regex') validateRegex(e.target.value);
              }}
              placeholder={
                patternType === 'keyword'
                  ? 'สรุป, drawing, rfa'
                  : '\\brfa\\b'
              }
              maxLength={255}
              required
            />
            {regexError && (
              <p className="text-xs text-destructive">{regexError}</p>
            )}
          </div>

          {/* Language */}
          <div className="space-y-1">
            <Label>ภาษา</Label>
            <Select
              value={language}
              onValueChange={(v) => setLanguage(v as PatternLanguage)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any (ทุกภาษา)</SelectItem>
                <SelectItem value="th">Thai (ภาษาไทย)</SelectItem>
                <SelectItem value="en">English (ภาษาอังกฤษ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label htmlFor="priority">Priority (ต่ำ = สำคัญกว่า)</Label>
            <Input
              id="priority"
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={1}
              max={9999}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading || !!regexError}>
              {isEdit ? 'บันทึก' : 'เพิ่ม'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
