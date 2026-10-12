'use client';

import { Drawing } from '@/types/drawing';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, Eye, GitCompare } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export function DrawingCard({ drawing }: { drawing: Drawing }) {
  return (
    <Card className="p-6 transition-shadow hover:shadow-md">
      <div className="flex gap-4">
        {/* Thumbnail Placeholder */}
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded bg-muted">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <h3 className="truncate text-lg font-semibold" title={drawing.drawingNumber || 'No Number'}>
                {drawing.drawingNumber || 'No Number'}
              </h3>
              <p className="truncate text-sm text-muted-foreground" title={drawing.title || 'No Title'}>
                {drawing.title || 'No Title'}
              </p>
            </div>
            <Badge variant="outline">
              {typeof drawing.discipline === 'object' ? drawing.discipline?.disciplineCode : drawing.discipline}
            </Badge>
          </div>

          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">Sheet:</span> {drawing.sheetNumber || '-'}
            </div>
            <div>
              <span className="font-medium text-foreground">Rev:</span> {drawing.revision || '0'}
            </div>
            {drawing.legacyDrawingNumber && (
              <div className="col-span-2">
                <span className="font-medium text-foreground">Legacy:</span> {drawing.legacyDrawingNumber}
              </div>
            )}
            {drawing.volumePage !== undefined && (
              <div>
                <span className="font-medium text-foreground">Page:</span> {drawing.volumePage}
              </div>
            )}
            <div>
              <span className="font-medium text-foreground">Scale:</span> {drawing.scale || 'N/A'}
            </div>
            <div>
              <span className="font-medium text-foreground">Date:</span>{' '}
              {drawing.issueDate && format(new Date(drawing.issueDate), 'dd/MM/yyyy')}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/drawings/${drawing.publicId}`}>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {(drawing.revisionCount || 0) > 1 && (
              <Button variant="outline" size="sm">
                <GitCompare className="mr-2 h-4 w-4" />
                Compare
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
