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
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBOWN: 'bg-yellow-100 text-yellow-700',
  CLBOWN: 'bg-green-100 text-green-700',
  CCBOWN: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
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
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4" />
          Revision History
          <Badge variant="secondary" className="ml-auto text-xs">
            {revisions.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

          <div className="space-y-4">
            {sorted.map((rev) => {
              const statusCode = rev.status?.statusCode ?? '';
              const statusLabel = STATUS_LABEL[statusCode] ?? statusCode;
              const statusClass = STATUS_CLASS[statusCode] ?? 'bg-gray-100 text-gray-700';
              const isCurrent = rev.isCurrent;

              return (
                <div key={rev.publicId ?? rev.revisionNumber} className="flex gap-3 pl-7 relative">
                  <div
                    className={`absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 ${
                      isCurrent
                        ? 'bg-primary border-primary'
                        : 'bg-background border-muted-foreground/40'
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">
                        Rev. {rev.revisionLabel ?? String(rev.revisionNumber).padStart(2, '0')}
                      </span>
                      {isCurrent && (
                        <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <Badge className={`text-xs px-1.5 py-0 border-0 ${statusClass}`}>
                        {statusLabel}
                      </Badge>
                    </div>

                    <p className="text-sm mt-0.5 line-clamp-1">{rev.subject}</p>

                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(rev.createdAt), 'dd MMM yyyy, HH:mm')}
                    </p>

                    {rev.remarks && (
                      <p className="text-xs text-muted-foreground italic mt-0.5 line-clamp-1">
                        {rev.remarks}
                      </p>
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
