'use client';

// File: components/ai/intent-classification/intent-form.tsx
// Change Log
// - 2026-05-19: สร้าง Intent Definition Form (Create/Update) (ADR-024).

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
  IntentDefinition,
  IntentCategory,
} from '@/lib/services/ai-intent.service';

interface IntentFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: {
    intentCode: string;
    descriptionTh: string;
    descriptionEn: string;
    category: IntentCategory;
  }) => void;
  /** ถ้ามี = edit mode */
  initial?: IntentDefinition;
  isLoading?: boolean;
}

/**
 * Dialog Form สำหรับสร้าง/แก้ไข Intent Definition
 */
export function IntentForm({
  open,
  onClose,
  onSubmit,
  initial,
  isLoading,
}: IntentFormProps) {
  const isEdit = !!initial;
  const [intentCode, setIntentCode] = useState(initial?.intentCode || '');
  const [descriptionTh, setDescriptionTh] = useState(initial?.descriptionTh || '');
  const [descriptionEn, setDescriptionEn] = useState(initial?.descriptionEn || '');
  const [category, setCategory] = useState<IntentCategory>(initial?.category || 'read');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ intentCode, descriptionTh, descriptionEn, category });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? `แก้ไข ${initial.intentCode}` : 'สร้าง Intent ใหม่'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Intent Code */}
          <div className="space-y-1">
            <Label htmlFor="intentCode">Intent Code</Label>
            <Input
              id="intentCode"
              value={intentCode}
              onChange={(e) => setIntentCode(e.target.value.toUpperCase())}
              placeholder="GET_RFA"
              pattern="^[A-Z][A-Z0-9_]*$"
              maxLength={50}
              disabled={isEdit}
              required
            />
            <p className="text-xs text-muted-foreground">
              UPPERCASE_SNAKE_CASE เช่น GET_RFA, SUMMARIZE_DOCUMENT
            </p>
          </div>

          {/* Description TH */}
          <div className="space-y-1">
            <Label htmlFor="descriptionTh">คำอธิบาย (ไทย)</Label>
            <Input
              id="descriptionTh"
              value={descriptionTh}
              onChange={(e) => setDescriptionTh(e.target.value)}
              placeholder="ดึง RFA ตาม filter"
              maxLength={255}
              required
            />
          </div>

          {/* Description EN */}
          <div className="space-y-1">
            <Label htmlFor="descriptionEn">Description (EN)</Label>
            <Input
              id="descriptionEn"
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder="Get RFA by filters"
              maxLength={255}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <Label>Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as IntentCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read">Read (ดึงข้อมูล)</SelectItem>
                <SelectItem value="suggest">Suggest (แนะนำ)</SelectItem>
                <SelectItem value="utility">Utility (อื่น ๆ)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isEdit ? 'บันทึก' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
