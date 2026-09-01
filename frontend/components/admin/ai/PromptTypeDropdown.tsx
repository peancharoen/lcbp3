// File: frontend/components/admin/ai/PromptTypeDropdown.tsx
// Change Log:
// - 2026-06-14: Created PromptTypeDropdown component (conforming to task T016)
// - 2026-06-15: Added "All Types" option (T064)
// - 2026-09-01: Fetch prompt types dynamically from ai_prompt_types API (Feature 251)

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from '@/hooks/use-translations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { AiPromptType } from '@/lib/types/ai-prompts';

interface PromptTypeDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * คอมโพเนนต์ Dropdown สำหรับเลือกประเภทของ AI Prompt
 * โหลดข้อมูลจาก ai_prompt_types API แบบ dynamic (Feature 251)
 */
export default function PromptTypeDropdown({
  value,
  onChange,
  disabled = false,
}: PromptTypeDropdownProps) {
  const t = useTranslations();
  const { data, isLoading } = useQuery<AiPromptType[]>({
    queryKey: ['ai-prompt-types'],
    queryFn: adminAiService.listPromptTypes,
  });

  const types = data ?? [];

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-medium text-muted-foreground">
        {t('prompt_management.prompt_type')}
      </label>
      <Select
        value={value}
        onValueChange={(val) => onChange(val)}
        disabled={disabled || isLoading}
      >
        <SelectTrigger className="w-full bg-background/50 border-border/50 backdrop-blur-sm">
          <SelectValue placeholder={t('prompt_management.prompt_type')} />
        </SelectTrigger>
        <SelectContent>
          {types.map((type) => (
            <SelectItem key={type.promptType} value={type.promptType}>
              {type.displayName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
