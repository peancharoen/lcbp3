// File: frontend/components/admin/ai/rag-console/ReOcrDiffView.tsx
// Change Log:
// - 2026-09-19: ADR-055 T025 — side-by-side diff (ข้อความปัจจุบัน ↔ ใหม่) + PDF reference pane + search-in-pane (D14/D16)
// - 2026-09-19: ADR-055 D22 — replace mode: PDF pane toggle เดิม/ใหม่ (default = ไฟล์ใหม่)

'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject, UIEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import apiClient from '@/lib/api/client';
import { useRagAdminT } from './rag-admin-i18n';

/** จำกัดจำนวน highlight เพื่อไม่ให้ DOM หนักเกินเมื่อ OCR text ยาวหลักแสนตัวอักษร */
const MAX_HIGHLIGHTS = 500;

export interface ReOcrDiffViewProps {
  attachmentPublicId: string;
  /** ocr_text ปัจจุบัน ('' = ยังไม่มี) */
  currentText: string;
  newText: string;
  engineUsed: string;
  /** replace mode: temp attachment ของไฟล์ใหม่ — แสดง toggle PDF เดิม/ใหม่ (D22) */
  candidatePublicId?: string;
}

/** แสดงข้อความเป็น <pre> พร้อม highlight คำค้น (ตัดที่ MAX_HIGHLIGHTS จุดแรก) */
function highlight(text: string, term: string): { nodes: ReactNode; count: number } {
  if (term.length < 2) return { nodes: text, count: 0 };
  const lower = text.toLowerCase();
  const needle = term.toLowerCase();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let count = 0;
  let idx = lower.indexOf(needle, cursor);
  while (idx !== -1) {
    count += 1;
    if (count <= MAX_HIGHLIGHTS) {
      nodes.push(text.slice(cursor, idx));
      nodes.push(
        <mark key={idx} data-testid="re-ocr-match" className="bg-yellow-200 text-foreground">
          {text.slice(idx, idx + needle.length)}
        </mark>
      );
      cursor = idx + needle.length;
    }
    idx = lower.indexOf(needle, idx + needle.length);
  }
  nodes.push(text.slice(cursor));
  return { nodes, count };
}

interface TextPaneProps {
  label: string;
  charCount: number;
  text: string;
  placeholder?: string;
  scrollRef: RefObject<HTMLPreElement | null>;
  onScroll: (e: UIEvent<HTMLPreElement>) => void;
}

/** pane ข้อความ + search box ของตัวเอง */
function TextPane({ label, charCount, text, placeholder, scrollRef, onScroll }: TextPaneProps) {
  const t = useRagAdminT();
  const [term, setTerm] = useState('');
  const { nodes, count } = highlight(text, term);
  const paneRef = useRef<HTMLDivElement>(null);

  // เลื่อนไปยัง match แรกเมื่อคำค้นเปลี่ยน
  useEffect(() => {
    if (count > 0) {
      paneRef.current?.querySelector('mark')?.scrollIntoView?.({ block: 'center' });
    }
  }, [term, count]);

  return (
    <div className="flex min-h-0 flex-col gap-2" ref={paneRef}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{t('re_ocr.diff.chars', { count: charCount })}</span>
      </div>
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('re_ocr.diff.search')}
        aria-label={`${label}: ${t('re_ocr.diff.search')}`}
      />
      {term.length >= 2 && (
        <span className="text-xs text-muted-foreground" data-testid="re-ocr-match-count">
          {count}
        </span>
      )}
      <pre
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded border bg-muted/30 p-3 font-mono text-xs"
      >
        {text.length === 0 && placeholder ? (
          <span className="italic text-muted-foreground">{placeholder}</span>
        ) : (
          nodes
        )}
      </pre>
    </div>
  );
}

/** PDF ต้นฉบับ — ดึงผ่าน apiClient (แนบ JWT) แล้วแสดงใน iframe
 *  ใช้ endpoint เฉพาะ re-ocr (guard ด้วย rag.manage) เพราะ /files/preview/:publicId ต้องการ document.view */
function PdfReferencePane({ attachmentPublicId }: { attachmentPublicId: string }) {
  const t = useRagAdminT();
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let currentUrl: string | null = null;
    let cancelled = false;
    apiClient
      .get(`/files/${attachmentPublicId}/re-ocr/preview`, {
        responseType: 'blob',
      })
      .then((res) => {
        if (cancelled) return;
        currentUrl = URL.createObjectURL(res.data as Blob);
        setBlobUrl(currentUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [attachmentPublicId]);

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <span className="text-sm font-medium">{t('re_ocr.diff.pdf')}</span>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded border bg-muted/30">
        {failed ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {t('re_ocr.diff.pdf_error')}
          </div>
        ) : blobUrl ? (
          <iframe src={blobUrl} title={t('re_ocr.diff.pdf')} className="h-full w-full border-0" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

/** เปรียบเทียบ 3 ฝั่ง: PDF ต้นฉบับ | ข้อความปัจจุบัน | ข้อความใหม่ (scroll sync ระหว่างสอง text pane) */
export function ReOcrDiffView({
  attachmentPublicId,
  currentText,
  newText,
  engineUsed,
  candidatePublicId,
}: ReOcrDiffViewProps) {
  const t = useRagAdminT();
  const leftRef = useRef<HTMLPreElement>(null);
  const rightRef = useRef<HTMLPreElement>(null);
  const syncing = useRef(false);
  // replace mode: PDF pane เลือกดูไฟล์เดิม/ใหม่ได้ — default = ไฟล์ใหม่ (Q7)
  const [pdfSource, setPdfSource] = useState<'old' | 'new'>('new');
  const pdfPublicId =
    candidatePublicId && pdfSource === 'new' ? candidatePublicId : attachmentPublicId;

  const sync = (source: RefObject<HTMLPreElement | null>, target: RefObject<HTMLPreElement | null>) =>
    (e: UIEvent<HTMLPreElement>) => {
      if (syncing.current || !target.current) return;
      syncing.current = true;
      const el = e.currentTarget;
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max > 0 ? el.scrollTop / max : 0;
      target.current.scrollTop = ratio * (target.current.scrollHeight - target.current.clientHeight);
      requestAnimationFrame(() => {
        syncing.current = false;
      });
      void source;
    };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex min-h-0 flex-col gap-2">
        {candidatePublicId && (
          <div className="flex shrink-0 gap-1" role="group" aria-label="PDF source">
            {(['new', 'old'] as const).map((v) => (
              <button
                key={v}
                type="button"
                data-testid={`pdf-toggle-${v}`}
                onClick={() => setPdfSource(v)}
                className={`rounded border px-2 py-0.5 text-xs ${
                  pdfSource === v ? 'bg-primary/10 font-medium' : 'text-muted-foreground'
                }`}
              >
                {t(v === 'new' ? 're_ocr.replace.pdf_new' : 're_ocr.replace.pdf_old')}
              </button>
            ))}
          </div>
        )}
        <PdfReferencePane attachmentPublicId={pdfPublicId} />
      </div>
      <TextPane
        label={t('re_ocr.diff.current')}
        charCount={currentText.length}
        text={currentText}
        placeholder={t('re_ocr.diff.no_current')}
        scrollRef={leftRef}
        onScroll={sync(leftRef, rightRef)}
      />
      <TextPane
        label={t('re_ocr.diff.new', { engine: engineUsed })}
        charCount={newText.length}
        text={newText}
        scrollRef={rightRef}
        onScroll={sync(rightRef, leftRef)}
      />
    </div>
  );
}
