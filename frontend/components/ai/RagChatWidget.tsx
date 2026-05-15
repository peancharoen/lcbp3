// File: components/ai/RagChatWidget.tsx
// Change Log
// - 2026-05-14: เพิ่ม RAG Chat Widget พร้อม BullMQ polling UI ตาม ADR-023 Phase 4 (T023).
'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, X, Loader2, AlertTriangle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AiRagCitation,
  AiRagJobResult,
  useCancelRagJob,
  useRagJobStatus,
  useSubmitRagQuery,
} from '@/lib/api/ai';

interface RagChatWidgetProps {
  /** publicId ของโครงการสำหรับ project-scoped vector search (FR-002) */
  projectPublicId: string;
  /** แสดง widget ในโหมด disabled เมื่อ AI host offline (FR-006) */
  isAiOffline?: boolean;
}

/** แปลง status เป็น badge variant */
function statusBadge(status: AiRagJobResult['status']): {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  switch (status) {
    case 'pending':
      return { label: 'รอในคิว...', variant: 'outline' };
    case 'processing':
      return { label: 'กำลังประมวลผล...', variant: 'secondary' };
    case 'completed':
      return { label: 'เสร็จสิ้น', variant: 'default' };
    case 'failed':
      return { label: 'ล้มเหลว', variant: 'destructive' };
    case 'cancelled':
      return { label: 'ยกเลิกแล้ว', variant: 'outline' };
    default:
      return { label: status, variant: 'outline' };
  }
}

/**
 * Widget สำหรับ RAG Conversational Q&A ผ่าน BullMQ polling (ADR-023 FR-009, FR-010, FR-011)
 * - ส่งคำถามเข้า /api/ai/rag/query → รับ requestPublicId
 * - Polling /api/ai/rag/jobs/:requestPublicId ทุก 2 วินาที
 * - แสดง status: pending → processing → completed/failed
 * - รองรับการยกเลิก job (FR-011)
 */
export function RagChatWidget({ projectPublicId, isAiOffline = false }: RagChatWidgetProps) {
  const [question, setQuestion] = useState('');
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submitMutation = useSubmitRagQuery();
  const cancelMutation = useCancelRagJob();

  const { data: jobResult } = useRagJobStatus(activeRequestId, isPolling);

  // หยุด polling เมื่อ job เสร็จ/ล้มเหลว/ยกเลิก
  useEffect(() => {
    if (!jobResult) return;
    if (
      jobResult.status === 'completed' ||
      jobResult.status === 'failed' ||
      jobResult.status === 'cancelled'
    ) {
      setIsPolling(false);
      if (jobResult.status === 'failed') {
        toast.error('การค้นหาล้มเหลว กรุณาลองใหม่อีกครั้ง');
      }
    }
  }, [jobResult]);

  const handleSubmit = async () => {
    const trimmed = question.trim();
    if (!trimmed || isAiOffline || submitMutation.isPending) return;

    try {
      const result = await submitMutation.mutateAsync({
        question: trimmed,
        projectPublicId,
      });
      setActiveRequestId(result.requestPublicId);
      setIsPolling(true);
    } catch {
      toast.error('ไม่สามารถส่งคำถามได้ กรุณาลองใหม่');
    }
  };

  const handleCancel = async () => {
    if (!activeRequestId) return;
    try {
      await cancelMutation.mutateAsync(activeRequestId);
      setIsPolling(false);
    } catch {
      toast.error('ไม่สามารถยกเลิกได้');
    }
  };

  const handleReset = () => {
    setQuestion('');
    setActiveRequestId(null);
    setIsPolling(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const isActive = submitMutation.isPending || isPolling;
  const showResult = !!jobResult && (jobResult.status === 'completed' || jobResult.status === 'failed');

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="h-4 w-4" />
          RAG Q&amp;A — ค้นหาจากเอกสารโครงการ
          {isAiOffline && (
            <Badge variant="destructive" className="ml-auto text-xs">
              AI Offline
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAiOffline && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              ระบบ AI ไม่พร้อมใช้งานในขณะนี้ ฟีเจอร์ RAG ถูกปิดใช้งานชั่วคราว (FR-006)
            </AlertDescription>
          </Alert>
        )}

        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            ref={textareaRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="พิมพ์คำถามเกี่ยวกับเอกสารโครงการ... (Ctrl+Enter เพื่อส่ง)"
            className="min-h-[80px] resize-none"
            maxLength={500}
            disabled={isAiOffline || isActive}
          />
          <p className="text-right text-xs text-muted-foreground">
            {question.length}/500
          </p>
        </div>

        {/* Job Status Indicator */}
        {activeRequestId && jobResult && (
          <div className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(jobResult.status === 'pending' || jobResult.status === 'processing') && (
                  <Loader2 className="h-3 w-3 animate-spin" />
                )}
                <Badge variant={statusBadge(jobResult.status).variant}>
                  {statusBadge(jobResult.status).label}
                </Badge>
              </div>
              {jobResult.status !== 'completed' && jobResult.status !== 'failed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleCancel()}
                  disabled={cancelMutation.isPending}
                  className="h-6 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  ยกเลิก
                </Button>
              )}
            </div>

            {/* Answer */}
            {showResult && jobResult.answer && (
              <div className="space-y-2">
                <p className="text-sm font-medium">คำตอบ:</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {jobResult.answer}
                </p>
                {typeof jobResult.confidence === 'number' && (
                  <p className="text-xs text-muted-foreground">
                    ความเชื่อมั่น: {(jobResult.confidence * 100).toFixed(1)}%
                    {jobResult.usedFallbackModel && ' (Fallback Model)'}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {showResult && jobResult.status === 'failed' && (
              <p className="text-sm text-destructive">{jobResult.errorMessage ?? 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}</p>
            )}

            {/* Citations */}
            {showResult && jobResult.citations && jobResult.citations.length > 0 && (
              <CitationList citations={jobResult.citations} />
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 pt-0">
        {!showResult ? (
          <Button
            onClick={() => void handleSubmit()}
            disabled={!question.trim() || isAiOffline || isActive}
            size="sm"
            className="ml-auto"
          >
            {isActive ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {isActive ? 'กำลังค้นหา...' : 'ส่งคำถาม'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={handleReset} className="ml-auto">
            ถามคำถามใหม่
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** แสดง citations จาก RAG results */
function CitationList({ citations }: { citations: AiRagCitation[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? citations : citations.slice(0, 3);

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">
        เอกสารอ้างอิง ({citations.length} รายการ):
      </p>
      {visible.map((c, index) => (
        <div
          key={`${String(c.pointId)}-${index}`}
          className="rounded border border-border bg-muted/40 p-2 text-xs space-y-0.5"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {c.docType ?? 'เอกสาร'}
              {c.docNumber ? ` — ${c.docNumber}` : ''}
            </span>
            <span className="text-muted-foreground shrink-0">
              {(c.score * 100).toFixed(1)}%
            </span>
          </div>
          {c.snippet && (
            <p className="text-muted-foreground line-clamp-2">{c.snippet}</p>
          )}
        </div>
      ))}
      {citations.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1 text-xs w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'แสดงน้อยลง' : `ดูอีก ${citations.length - 3} รายการ`}
        </Button>
      )}
    </div>
  );
}
