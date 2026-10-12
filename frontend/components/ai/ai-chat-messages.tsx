// File: frontend/components/ai/ai-chat-messages.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์แสดงผลประวัติการสนทนาและการตอบสนองของ AI
// - 2026-09-05: ADR-051 D2 — รับ prop isColdStartLikely เพื่อสลับข้อความ loading
//   เป็น "ระบบกำลังเตรียมโมเดล AI" เมื่อ request ช้าผิดปกติ (response-time heuristic)

'use client';

import { useRef, useEffect } from 'react';
import { Bot, User, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/types/ai-chat';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/hooks/use-translations';

interface AiChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSuggestedActionClick: (query: string) => void;
  /** ADR-051 D2: true เมื่อ request รอนานผิดปกติ — น่าจะ Ollama cold-start จาก mid-flight race */
  isColdStartLikely?: boolean;
}

export function AiChatMessages({
  messages,
  isLoading,
  onSuggestedActionClick,
  isColdStartLikely = false,
}: AiChatMessagesProps) {
  const t = useTranslations();
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);
  const parseMarkdown = (text: string) => {
    if (!text) return null;
    const lines = text.split('\n');
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    const elements: React.ReactNode[] = [];
    const renderInline = (lineText: string, key: string) => {
      const parts = lineText.split(/(\*\*.*?\*\*|`.*?`)/g);
      return (
        <span key={key}>
          {parts.map((part, index) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={index} className="font-semibold text-foreground">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return (
                <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-ai">
                  {part.slice(1, -1)}
                </code>
              );
            }
            return part;
          })}
        </span>
      );
    };
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${index}`}
              className="my-2 overflow-x-auto whitespace-pre rounded-lg border bg-muted p-3 font-mono text-xs text-foreground"
            >
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        return;
      }
      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <li key={`li-${index}`} className="my-1 ml-5 list-disc text-sm leading-relaxed">
            {renderInline(trimmed.slice(2), `li-inline-${index}`)}
          </li>
        );
        return;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const dotIndex = trimmed.indexOf('.');
        elements.push(
          <li key={`ol-${index}`} className="my-1 ml-5 list-decimal text-sm leading-relaxed">
            {renderInline(trimmed.slice(dotIndex + 1).trim(), `ol-inline-${index}`)}
          </li>
        );
        return;
      }
      if (trimmed.startsWith('#')) {
        const hashCount = (trimmed.match(/^#+/) || [''])[0].length;
        const headerText = trimmed.replace(/^#+\s*/, '');
        if (hashCount === 1)
          elements.push(
            <h1 key={`h1-${index}`} className="mb-1 mt-3 text-lg font-bold text-foreground">
              {renderInline(headerText, `h1-inline-${index}`)}
            </h1>
          );
        else if (hashCount === 2)
          elements.push(
            <h2 key={`h2-${index}`} className="mb-1 mt-2 text-base font-bold text-foreground">
              {renderInline(headerText, `h2-inline-${index}`)}
            </h2>
          );
        else
          elements.push(
            <h3 key={`h3-${index}`} className="mb-1 mt-2 text-sm font-semibold text-foreground">
              {renderInline(headerText, `h3-inline-${index}`)}
            </h3>
          );
        return;
      }
      if (trimmed === '') {
        elements.push(<div key={`br-${index}`} className="h-2" />);
        return;
      }
      elements.push(
        <p key={`p-${index}`} className="my-1 text-sm leading-relaxed">
          {renderInline(line, `p-inline-${index}`)}
        </p>
      );
    });
    return <div className="space-y-1">{elements}</div>;
  };
  return (
    <ScrollArea className="flex-1 bg-muted/30 p-4">
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-ai to-ai text-white shadow-md">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">ยินดีต้อนรับสู่ระบบช่วยเหลือ AI</h3>
            <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">
              คุณสามารถพิมพ์ถามคำถามเพื่อขอสรุปข้อมูล ตรวจสอบความถูกต้อง หรือค้นหาเงื่อนไขในเอกสารฉบับนี้ได้ทันที
            </p>
          </div>
        )}
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isError = message.content === 'ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่';
          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ${isError ? 'bg-destructive/10 text-destructive' : 'bg-gradient-to-tr from-ai to-ai text-white'}`}
                >
                  {isError ? <AlertCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
              )}
              <div className={`flex max-w-[80%] flex-col gap-1.5`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isUser ? 'rounded-tr-none bg-ai font-medium text-white' : isError ? 'rounded-tl-none border border-destructive/20 bg-destructive/10 text-destructive' : 'rounded-tl-none border bg-card text-card-foreground'}`}
                >
                  {message.isStreaming ? (
                    <div className="flex select-none items-center gap-2 py-1 text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">
                        {isColdStartLikely ? t('ai.coldStart.hint') : 'AI กำลังอ่านวิเคราะห์ข้อมูลเอกสาร...'}
                      </span>
                    </div>
                  ) : isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  ) : (
                    parseMarkdown(message.content)
                  )}
                </div>
                {!isUser && message.suggestedActions && message.suggestedActions.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {message.suggestedActions.map((action, idx) => (
                      <button
                        key={`${action.label}-${idx}`}
                        onClick={() => onSuggestedActionClick(action.query)}
                        className="select-none rounded-full border border-ai/30 bg-ai/50 px-2.5 py-1 text-xs font-medium text-ai transition-colors hover:bg-ai/10"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isUser && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground shadow-sm">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {isLoading && messages.length > 0 && !messages[messages.length - 1].isStreaming && (
          <div className="flex justify-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr from-ai to-ai text-white shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border bg-card px-4 py-2.5 text-card-foreground shadow-sm">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">{isColdStartLikely ? t('ai.coldStart.hint') : 'AI กำลังประมวลผลคำตอบ...'}</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
