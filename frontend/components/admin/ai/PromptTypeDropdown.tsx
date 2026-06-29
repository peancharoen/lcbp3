// File: frontend/components/admin/ai/PromptTypeDropdown.tsx
// Change Log:
// - 2026-06-14: Created PromptTypeDropdown component (conforming to task T016)
// - 2026-06-15: Added "All Types" option (T064)

import React from 'react';
import { useTranslations } from '@/hooks/use-translations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PromptType } from '@/lib/types/ai-prompts';

interface PromptTypeDropdownProps {
  value: PromptType | 'all';
  onChange: (value: PromptType | 'all') => void;
  disabled?: boolean;
  showAllOption?: boolean;
}

/**
 * คอมโพเนนต์ Dropdown สำหรับเลือกประเภทของ AI Prompt
 * รองรับ: OCR Extraction, RAG Query, RAG Prep, และ Document Classification
 * และ "All Types" สำหรับดูทุกประเภท (T064)
 */
export default function PromptTypeDropdown({
  value,
  onChange,
  disabled = false,
  showAllOption = false,
}: PromptTypeDropdownProps) {
  const t = useTranslations();

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-medium text-muted-foreground">
        {t('prompt_management.prompt_type')}
      </label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as PromptType | 'all')}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm">
          <SelectValue placeholder={t('prompt_management.prompt_type')} />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              {t('prompt_management.all_types')}
            </SelectItem>
          )}
          <SelectItem value="ocr_system">
            คำสั่งระบบ OCR (OCR System Prompt)
          </SelectItem>
          <SelectItem value="ocr_extraction">
            สกัดข้อความ OCR (OCR Extraction)
          </SelectItem>
          <SelectItem value="rag_query_prompt">
            ค้นหาข้อมูล RAG (RAG Query)
          </SelectItem>
          <SelectItem value="rag_prep_prompt">
            เตรียมข้อมูล RAG (RAG Prep)
          </SelectItem>
          <SelectItem value="classification_prompt">
            จำแนกประเภทเอกสาร (Classification)
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
