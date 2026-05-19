// File: frontend/components/ai/ai-chat-panel.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์หลักสำหรับแผงแชท AI (AI Chat Panel) ด้านข้าง

'use client';

import { useEffect } from 'react';

import { X, Trash2, Bot, Sparkles } from 'lucide-react';
import { useAiChat } from '@/hooks/use-ai-chat';
import { AiChatMessages } from '@/components/ai/ai-chat-messages';
import { AiChatInput } from '@/components/ai/ai-chat-input';
import { Button } from '@/components/ui/button';
import { ChatContext } from '@/types/ai-chat';

interface AiChatPanelProps {
  context: ChatContext;
  isOpen: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

export function AiChatPanel({ context, isOpen, onClose, onToggle }: AiChatPanelProps) {
  const {
    messages,
    sendMessage,
    clearHistory,
    isLoading,
  } = useAiChat(context);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '.') {
        e.preventDefault();
        onToggle?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);
  const handleSuggestedAction = (queryText: string) => {
    void sendMessage(queryText);
  };
  return (
    <div
      className={`fixed z-40 bg-background shadow-2xl transition-transform duration-300 ease-in-out flex flex-col border-t rounded-t-3xl bottom-0 top-auto right-0 left-0 w-full h-[60%] lg:top-0 lg:bottom-auto lg:right-0 lg:left-auto lg:h-full lg:w-[400px] lg:border-l lg:border-t-0 lg:rounded-t-none ${
        isOpen
          ? 'translate-x-0 translate-y-0'
          : 'translate-x-0 translate-y-full lg:translate-x-full lg:translate-y-0'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b px-4 bg-gradient-to-r from-violet-50/50 to-indigo-50/50 dark:from-violet-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
            <Bot className="h-4 w-4" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-green-500" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1">
              ผู้ช่วยอัจฉริยะ AI
              <Sparkles className="h-3.5 w-3.5 text-violet-500 animate-pulse" />
            </h2>
            <p className="text-[10px] text-muted-foreground font-medium">พร้อมช่วยเหลือแบบเรียลไทม์</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-destructive text-muted-foreground rounded-lg"
              onClick={clearHistory}
              title="ล้างประวัติการสนทนา"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted text-muted-foreground rounded-lg"
            onClick={onClose}
            title="ปิดหน้าต่างแชท"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <AiChatMessages
        messages={messages}
        isLoading={isLoading}
        onSuggestedActionClick={handleSuggestedAction}
      />
      <AiChatInput onSend={sendMessage} isLoading={isLoading} />
    </div>
  );
}
