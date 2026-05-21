// File: components/ai/ai-suggestion-button.tsx
// Change Log
// - 2026-05-21: เพิ่มปุ่ม AI Suggestion พร้อม soft fallback เมื่อ AI ถูกปิด.
'use client';

import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';

const DEFAULT_DISABLED_MESSAGE = 'ระบบ AI ไม่พร้อมใช้งานชั่วคราว กรุณากรอกข้อมูลด้วยตนเอง';

interface AiSuggestionButtonProps {
  aiEnabled: boolean;
  isLoading?: boolean;
  label?: string;
  disabledMessage?: string;
  onClick?: () => void;
}

/** ปุ่มเรียก AI suggestion ที่แสดง fallback ชัดเจนเมื่อระบบ AI ปิด */
export function AiSuggestionButton({
  aiEnabled,
  isLoading = false,
  label = 'AI Suggestion',
  disabledMessage = DEFAULT_DISABLED_MESSAGE,
  onClick,
}: AiSuggestionButtonProps) {
  const disabled = !aiEnabled || isLoading;
  const button = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      aria-label={label}
      onClick={disabled ? undefined : onClick}
      className="gap-2"
    >
      <Sparkles className="h-4 w-4" />
      {label}
    </Button>
  );

  if (aiEnabled) return button;

  return (
    <HoverCard openDelay={100}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-not-allowed">
          {button}
          <span className="sr-only">{disabledMessage}</span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="border-amber-200 bg-amber-50 text-amber-900">
        <p className="text-sm">{disabledMessage}</p>
      </HoverCardContent>
    </HoverCard>
  );
}
