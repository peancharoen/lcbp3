// File: frontend/components/ai/ai-chat-toggle.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์ปุ่มเปิด/ปิด AI Document Chat Panel

'use client';

import { MessageSquare, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AiChatToggleProps {
  isOpen: boolean;
  onClick: () => void;
}

export function AiChatToggle({ isOpen, onClick }: AiChatToggleProps) {
  return (
    <Button
      onClick={onClick}
      className={`hover:scale-115 fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300 ease-in-out ${
        isOpen
          ? 'rotate-90 bg-destructive text-destructive-foreground hover:bg-destructive/95'
          : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 hover:shadow-violet-500/20'
      }`}
      size="icon"
      aria-label={isOpen ? 'ปิดช่องแชท AI' : 'เปิดช่องแชท AI'}
    >
      {isOpen ? (
        <X className="h-6 w-6 transition-transform duration-200" />
      ) : (
        <MessageSquare className="h-6 w-6 transition-transform duration-200" />
      )}
    </Button>
  );
}
