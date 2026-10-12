'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, CheckCircle2 } from 'lucide-react';
import { CorrespondenceRevision } from '@/types/correspondence';
import { format } from 'date-fns';

interface RevisionHistoryProps {
  revisions: CorrespondenceRevision[];
}

const STATUS_CLASS: Record<string, string> = {
  DRAFT: 'bg-muted text-foreground',
  SUBOWN: 'bg-warning/10 text-warning',
  CLBOWN: 'bg-success/10 text-success',
  CCBOWN: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  SUBOWN: 'Submitted',
  CLBOWN: 'Approved',
  CCBOWN: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function RevisionHistory({ revisions }: RevisionHistoryProps) {
  if (!revisions || revisions.length === 0) return null;

  const sorted = [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" />
          Revision History
          <Badge variant="secondary" className="ml-auto text-xs">
            {revisions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute bottom-0 left-3 top-0 w-px bg-border" />

          <div className="space-y-4">
            {sorted.map((rev) => {
              const statusCode = rev.status?.statusCode ?? '';
              const statusLabel = STATUS_LABEL[statusCode] ?? statusCode;
              const statusClass = STATUS_CLASS[statusCode] ?? 'bg-muted text-foreground';
              const isCurrent = rev.isCurrent;

              return (
                <div key={rev.publicId ?? rev.revisionNumber} className="relative flex gap-3 pl-7">
                  <div
                    className={`absolute left-1.5 top-1 h-3 w-3 rounded-full border-2 ${
                      isCurrent ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-background'
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold">
                        Rev. {rev.revisionLabel ?? String(rev.revisionNumber).padStart(2, '0')}
                      </span>
                      {isCurrent && <CheckCircle2 className="h-3 w-3 shrink-0 text-primary" />}
                      <Badge className={`border-0 px-1.5 py-0 text-xs ${statusClass}`}>{statusLabel}</Badge>
                    </div>

                    <p className="mt-0.5 line-clamp-1 text-sm">{rev.subject}</p>

                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {format(new Date(rev.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>

                    {rev.remarks && (
                      <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground">{rev.remarks}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
