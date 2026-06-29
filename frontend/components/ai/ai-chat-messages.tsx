// File: frontend/components/ai/ai-chat-messages.tsx
// Change Log:
// - 2026-05-19: สร้างคอมโพเนนต์แสดงผลประวัติการสนทนาและการตอบสนองของ AI

'use client';

import { useRef, useEffect } from 'react';
import { Bot, User, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/types/ai-chat';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AiChatMessagesProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSuggestedActionClick: (query: string) => void;
}

export function AiChatMessages({ messages, isLoading, onSuggestedActionClick }: AiChatMessagesProps) {
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
              return <strong key={index} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith('`') && part.endsWith('`')) {
              return <code key={index} className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs text-violet-600">{part.slice(1, -1)}</code>;
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
            <pre key={`code-${index}`} className="bg-muted border rounded-lg p-3 text-xs font-mono overflow-x-auto my-2 text-foreground whitespace-pre">
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
          <li key={`li-${index}`} className="ml-5 list-disc my-1 text-sm leading-relaxed">
            {renderInline(trimmed.slice(2), `li-inline-${index}`)}
          </li>
        );
        return;
      }
      if (/^\d+\.\s/.test(trimmed)) {
        const dotIndex = trimmed.indexOf('.');
        elements.push(
          <li key={`ol-${index}`} className="ml-5 list-decimal my-1 text-sm leading-relaxed">
            {renderInline(trimmed.slice(dotIndex + 1).trim(), `ol-inline-${index}`)}
          </li>
        );
        return;
      }
      if (trimmed.startsWith('#')) {
        const hashCount = (trimmed.match(/^#+/) || [''])[0].length;
        const headerText = trimmed.replace(/^#+\s*/, '');
        if (hashCount === 1) elements.push(<h1 key={`h1-${index}`} className="text-lg font-bold mt-3 mb-1 text-foreground">{renderInline(headerText, `h1-inline-${index}`)}</h1>);
        else if (hashCount === 2) elements.push(<h2 key={`h2-${index}`} className="text-base font-bold mt-2 mb-1 text-foreground">{renderInline(headerText, `h2-inline-${index}`)}</h2>);
        else elements.push(<h3 key={`h3-${index}`} className="text-sm font-semibold mt-2 mb-1 text-foreground">{renderInline(headerText, `h3-inline-${index}`)}</h3>);
        return;
      }
      if (trimmed === '') {
        elements.push(<div key={`br-${index}`} className="h-2" />);
        return;
      }
      elements.push(
        <p key={`p-${index}`} className="text-sm leading-relaxed my-1">
          {renderInline(line, `p-inline-${index}`)}
        </p>
      );
    });
    return <div className="space-y-1">{elements}</div>;
  };
  return (
    <ScrollArea className="flex-1 p-4 bg-muted/30">
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-12 px-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-violet-500 to-indigo-500 flex items-center justify-center text-white mb-3 shadow-md">
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">ยินดีต้อนรับสู่ระบบช่วยเหลือ AI</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
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
                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center shadow-sm ${isError ? 'bg-destructive/10 text-destructive' : 'bg-gradient-to-tr from-violet-500 to-indigo-500 text-white'}`}>
                  {isError ? <AlertCircle className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>
              )}
              <div className={`flex flex-col max-w-[80%] gap-1.5`}>
                <div className={`rounded-2xl px-4 py-2.5 shadow-sm text-sm ${isUser ? 'bg-violet-600 text-white rounded-tr-none font-medium' : isError ? 'bg-destructive/10 border border-destructive/20 text-destructive rounded-tl-none' : 'bg-card border text-card-foreground rounded-tl-none'}`}>
                  {message.isStreaming ? (
                    <div className="flex items-center gap-2 text-muted-foreground select-none py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span className="text-xs">AI กำลังอ่านวิเคราะห์ข้อมูลเอกสาร...</span>
                    </div>
                  ) : isUser ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  ) : (
                    parseMarkdown(message.content)
                  )}
                </div>
                {!isUser && message.suggestedActions && message.suggestedActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {message.suggestedActions.map((action, idx) => (
                      <button
                        key={`${action.label}-${idx}`}
                        onClick={() => onSuggestedActionClick(action.query)}
                        className="text-xs px-2.5 py-1 rounded-full border border-violet-200 bg-violet-50/50 text-violet-700 hover:bg-violet-100 transition-colors font-medium select-none"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isUser && (
                <div className="h-8 w-8 rounded-lg shrink-0 bg-secondary flex items-center justify-center text-secondary-foreground shadow-sm">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          );
        })}
        {isLoading && messages.length > 0 && !messages[messages.length - 1].isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="h-8 w-8 rounded-lg shrink-0 bg-gradient-to-tr from-violet-500 to-indigo-500 text-white flex items-center justify-center shadow-sm">
              <Bot className="h-4 w-4" />
            </div>
            <div className="rounded-2xl px-4 py-2.5 shadow-sm bg-card border text-card-foreground rounded-tl-none flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs">AI กำลังประมวลผลคำตอบ...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
