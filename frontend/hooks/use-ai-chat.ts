// File: frontend/hooks/use-ai-chat.ts
// Change Log:
// - 2026-05-19: พัฒนา Hook useAiChat สำหรับระบบแชท AI ในหน้าเอกสาร
// - 2026-09-04: Two-Phase Batch OCR/AI Extraction (D267) — เมื่อเจอ 503 AI_FEATURES_UNAVAILABLE
//   (main model ถูก unload ระหว่าง legacy batch OCR phase) แสดง dialog รอ/ยกเลิกแทนการ append
//   error bubble คงที่ทันที — ใช้ useAiUnavailableRetry (backoff retry ทุก 8s จนสำเร็จหรือ cancel)
// - 2026-09-05: ADR-051 D2 — expose isColdStartLikely (response-time heuristic ผ่าน
//   useColdStartHint) ให้ UI เปลี่ยน spinner เป็นข้อความ "กำลังเตรียมโมเดล AI" เมื่อ request
//   ช้าผิดปกติจาก residual mid-flight race ระหว่าง OCR batch unload→reload main model

import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { ChatMessage, ChatContext, ChatResponseDto } from '@/types/ai-chat';
import { useAiUnavailableRetry } from './use-ai-unavailable-retry';
import { useColdStartHint } from './use-cold-start-hint';

function isAiFeaturesUnavailableError(err: unknown): boolean {
  if (!axios.isAxiosError(err) || err.response?.status !== 503) return false;
  const data = err.response.data as { error?: { code?: string } } | undefined;
  return data?.error?.code === 'AI_FEATURES_UNAVAILABLE';
}

export function useAiChat(context: ChatContext) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const pendingMessageIdRef = useRef<string | null>(null);
  const {
    isDialogOpen: isAiUnavailableDialogOpen,
    isRetrying: isAiUnavailableRetrying,
    elapsedSeconds: aiUnavailableElapsedSeconds,
    trigger: triggerAiUnavailableRetry,
    wait: waitAiUnavailableRetry,
    cancel: cancelAiUnavailableRetry,
  } = useAiUnavailableRetry();
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
  // ADR-051 D2: ถ้า request รอนานเกิน threshold ให้ถือว่าน่าจะ cold-start (main model
  // ถูก unload โดย mid-flight ocr-extract race) — UI จะสลับข้อความ loading ให้มีบริบท
  const isColdStartLikely = useColdStartHint(chatMutation.isPending);
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
    pendingMessageIdRef.current = systemLoadingMsg.id;
    setMessages([...currentMsgs, systemLoadingMsg]);
    const applyAssistantResult = (result: ChatResponseDto) => {
      const assistantMsg: ChatMessage = {
        id: result.messageId || crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        timestamp: new Date().toISOString(),
        suggestedActions: result.suggestedActions,
      };
      pendingMessageIdRef.current = null;
      saveMessages([...currentMsgs, assistantMsg]);
    };
    try {
      const result = await chatMutation.mutateAsync(queryText);
      applyAssistantResult(result);
    } catch (err: unknown) {
      // D267: main model ถูก unload ระหว่าง legacy batch OCR phase — แสดง dialog รอ/ยกเลิก
      // แทนการ append error bubble คงที่ทันที (ผู้ใช้เลือกเองว่าจะรอหรือยกเลิก)
      if (isAiFeaturesUnavailableError(err)) {
        triggerAiUnavailableRetry(async () => {
          const result = await chatMutation.mutateAsync(queryText);
          applyAssistantResult(result);
        });
        return;
      }
      pendingMessageIdRef.current = null;
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่',
        timestamp: new Date().toISOString(),
      };
      saveMessages([...currentMsgs, errorMsg]);
    }
  }, [messages, saveMessages, chatMutation, triggerAiUnavailableRetry]);
  const cancelAiUnavailableWait = useCallback(() => {
    cancelAiUnavailableRetry();
    const pendingId = pendingMessageIdRef.current;
    if (pendingId) {
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m.id === pendingId
            ? {
                ...m,
                isStreaming: false,
                content: 'ผู้ใช้ยกเลิกการส่งข้อความ',
              }
            : m
        );
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(storageKey, JSON.stringify(updated));
        }
        return updated;
      });
      pendingMessageIdRef.current = null;
    }
  }, [cancelAiUnavailableRetry, storageKey]);
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
    isColdStartLikely,
    isAiUnavailableDialogOpen,
    isAiUnavailableRetrying,
    aiUnavailableElapsedSeconds,
    waitAiUnavailableRetry,
    cancelAiUnavailableWait,
    isOpen,
    setIsOpen,
    toggleOpen,
  };
}
