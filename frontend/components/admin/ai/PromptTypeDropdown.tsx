// File: frontend/components/admin/ai/PromptTypeDropdown.tsx
// Change Log:
// - 2026-06-14: Created PromptTypeDropdown component (conforming to task T016)

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PromptType } from '@/lib/types/ai-prompts';

interface PromptTypeDropdownProps {
  value: PromptType;
  onChange: (value: PromptType) => void;
  disabled?: boolean;
}

/**
 * คอมโพเนนต์ Dropdown สำหรับเลือกประเภทของ AI Prompt
 * รองรับ: OCR Extraction, RAG Query, RAG Prep, และ Document Classification
 */
export default function PromptTypeDropdown({
  value,
  onChange,
  disabled = false,
}: PromptTypeDropdownProps) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-medium text-muted-foreground">
        ประเภทของพรอมต์ (Prompt Type)
      </label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val as PromptType)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm">
          <SelectValue placeholder="เลือกประเภทพรอมต์..." />
        </SelectTrigger>
        <SelectContent>
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
