// File: frontend/components/ai/ai-chat-input.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์สำหรับรับข้อมูลข้อความ (Chat Input)

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface AiChatInputProps {
  onSend: (text: string) => void;
  isLoading: boolean;
}

export function AiChatInput({ onSend, isLoading }: AiChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !isLoading) {
      onSend(trimmed);
      setValue('');
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [value]);
  return (
    <div className="relative flex items-end gap-2 border-t bg-card p-3">
      <div className="relative flex-1">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value.slice(0, 500))}
          onKeyDown={handleKeyDown}
          placeholder="ถาม AI เกี่ยวกับเอกสารนี้... (Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัดใหม่)"
          className="min-h-[40px] max-h-[120px] resize-none pr-12 text-sm focus-visible:ring-1 focus-visible:ring-violet-500 rounded-lg py-2.5"
          disabled={isLoading}
        />
        <div className="absolute bottom-1 right-2 text-[10px] text-muted-foreground select-none">
          {value.length}/500
        </div>
      </div>
      <Button
        onClick={handleSubmit}
        disabled={!value.trim() || isLoading}
        size="icon"
        className="h-10 w-10 shrink-0 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
        aria-label="ส่งข้อความ"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
