'use client';

import { FileText } from 'lucide-react';
import type { RagQueryResponse, RagCitation } from '../../hooks/use-rag';
import { RagFallbackBadge } from './rag-fallback-badge';

interface RagResultCardProps {
  result: RagQueryResponse;
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  );
}

function CitationItem({ citation }: { citation: RagCitation }) {
  return (
    <div className="rounded border p-3 text-sm space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span>{citation.docType}</span>
          {citation.docNumber && (
            <span className="text-muted-foreground">— {citation.docNumber}</span>
          )}
          {citation.revision && (
            <span className="rounded bg-muted px-1 text-xs">Rev. {citation.revision}</span>
          )}
        </div>
        <ConfidenceBar score={citation.score} />
      </div>
      <p className="text-muted-foreground line-clamp-3">{citation.snippet}</p>
    </div>
  );
}

export function RagResultCard({ result }: RagResultCardProps) {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="font-semibold text-base mb-1">คำตอบ</h3>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{result.answer}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <ConfidenceBar score={result.confidence} />
          {result.usedFallbackModel && <RagFallbackBadge />}
        </div>
      </div>

      {result.citations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            อ้างอิง ({result.citations.length} เอกสาร)
          </h4>
          <div className="space-y-2">
            {result.citations.map((c) => (
              <CitationItem key={c.chunkId} citation={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
