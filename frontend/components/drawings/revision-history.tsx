'use client';

import { DrawingRevision } from '@/types/drawing';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { format } from 'date-fns';

export function RevisionHistory({ revisions }: { revisions: DrawingRevision[] }) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 text-lg font-semibold">Revision History</h3>

      <div className="space-y-3">
        {revisions.map((rev) => (
          <div key={rev.publicId} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex-1">
              <div className="mb-1 flex items-center gap-3">
                <Badge variant={rev.isCurrent ? 'default' : 'outline'}>Rev. {rev.revisionNumber}</Badge>
                {rev.isCurrent && (
                  <span className="flex items-center gap-1 text-xs font-medium text-success">
                    <div className="h-1.5 w-1.5 rounded-full bg-success" />
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-foreground">{rev.revisionDescription || 'No description'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(new Date(rev.revisionDate), 'dd MMM yyyy')} by {rev.revisedByName}
              </p>
            </div>

            <Button variant="ghost" size="sm" title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
