// File: frontend/hooks/use-ai-chat.ts
// Change Log:
// - 2026-05-19: พัฒนา Hook useAiChat สำหรับระบบแชท AI ในหน้าเอกสาร

import { useState, useEffect, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChatMessage, ChatContext, ChatResponseDto } from '@/types/ai-chat';

export function useAiChat(context: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const storageKey = `ai_chat_session_${context.type}_${context.publicId}`;
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (_) {
          setMessages([]);
        }
      } else {
        setMessages([]);
      }
    }
  }, [storageKey]);
  const saveMessages = useCallback((newMsgs: ChatMessage[]) => {
    setMessages(newMsgs);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, JSON.stringify(newMsgs));
    }
  }, [storageKey]);
  const chatMutation = useMutation({
    mutationFn: async (queryText: string): Promise<ChatResponseDto> => {
      const response = await axios.post('/api/ai/chat', {
        query: queryText,
        context,
      });
      return response.data;
    },
  });
  const sendMessage = useCallback(async (queryText: string) => {
    if (!queryText.trim()) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: queryText,
      timestamp: new Date().toISOString(),
    };
    const currentMsgs = [...messages, userMsg];
    saveMessages(currentMsgs);
    const systemLoadingMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      isStreaming: true,
    };
    setMessages([...currentMsgs, systemLoadingMsg]);
    try {
      const result = await chatMutation.mutateAsync(queryText);
      const assistantMsg: ChatMessage = {
        id: result.messageId || crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
        suggestedActions: result.suggestedActions,
      };
      saveMessages([...currentMsgs, assistantMsg]);
    } catch (_err) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่',
        timestamp: new Date().toISOString(),
      };
      saveMessages([...currentMsgs, errorMsg]);
    }
  }, [messages, saveMessages, chatMutation]);
  const clearHistory = useCallback(() => {
    saveMessages([]);
  }, [saveMessages]);
  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);
  return {
    messages,
    sendMessage,
    clearHistory,
    isLoading: chatMutation.isPending,
    isOpen,
    setIsOpen,
    toggleOpen,
  };
}
