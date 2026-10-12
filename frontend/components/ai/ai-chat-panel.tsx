// File: frontend/components/ai/ai-chat-panel.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์หลักสำหรับแผงแชท AI (AI Chat Panel) ด้านข้าง

'use client';

import { useEffect } from 'react';

import { X, Trash2, Bot, Sparkles } from 'lucide-react';
import { useAiChat } from '@/hooks/use-ai-chat';
import { AiChatMessages } from '@/components/ai/ai-chat-messages';
import { AiChatInput } from '@/components/ai/ai-chat-input';
import { AiUnavailableWaitDialog } from '@/components/ai/ai-unavailable-wait-dialog';
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
    isColdStartLikely,
    isAiUnavailableDialogOpen,
    isAiUnavailableRetrying,
    aiUnavailableElapsedSeconds,
    waitAiUnavailableRetry,
    cancelAiUnavailableWait,
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
      className={`fixed bottom-0 left-0 right-0 top-auto z-40 flex h-[60%] w-full flex-col rounded-t-3xl border-t bg-background shadow-2xl transition-transform duration-300 ease-in-out lg:bottom-auto lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[400px] lg:rounded-t-none lg:border-l lg:border-t-0 ${
        isOpen ? 'translate-x-0 translate-y-0' : 'translate-x-0 translate-y-full lg:translate-x-full lg:translate-y-0'
      }`}
    >
      <div className="flex h-16 items-center justify-between border-b bg-gradient-to-r from-violet-50/50 to-indigo-50/50 px-4 dark:from-violet-950/20 dark:to-indigo-950/20">
        <div className="flex items-center gap-2">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
            <Bot className="h-4 w-4" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-success" />
          </div>
          <div>
            <h2 className="flex items-center gap-1 text-sm font-semibold text-foreground">
              ผู้ช่วยอัจฉริยะ AI
              <Sparkles className="h-3.5 w-3.5 animate-pulse text-violet-500" />
            </h2>
            <p className="text-[10px] font-medium text-muted-foreground">พร้อมช่วยเหลือแบบเรียลไทม์</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive"
              onClick={clearHistory}
              title="ล้างประวัติการสนทนา"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted"
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
        isColdStartLikely={isColdStartLikely}
      />
      <AiChatInput onSend={sendMessage} isLoading={isLoading} />
      <AiUnavailableWaitDialog
        open={isAiUnavailableDialogOpen}
        isRetrying={isAiUnavailableRetrying}
        elapsedSeconds={aiUnavailableElapsedSeconds}
        onWait={waitAiUnavailableRetry}
        onCancel={cancelAiUnavailableWait}
      />
    </div>
  );
}
