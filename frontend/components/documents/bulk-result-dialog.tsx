'use client';

// File: frontend/components/documents/bulk-result-dialog.tsx
// Feature 253 T111: Bulk operation result dialog with per-item success/failed summary

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslations } from '@/hooks/use-translations';

export interface BulkResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  success: number;
  failed: number;
  failedItems?: string[];
}

export function BulkResultDialog({
  open,
  onOpenChange,
  total,
  success,
  failed,
  failedItems,
}: BulkResultDialogProps) {
  const t = useTranslations();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('document.bulk.resultDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('document.bulk.resultDialog.description', {
              success,
              failed,
              total,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t('document.bulk.resultDialog.totalColumn')}</p>
              <p className="text-lg font-semibold">{total}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t('document.bulk.resultDialog.successColumn')}</p>
              <p className="text-lg font-semibold text-green-600">{success}</p>
            </div>
            <div className="rounded-md border p-2">
              <p className="text-xs text-muted-foreground">{t('document.bulk.resultDialog.failedColumn')}</p>
              <p className="text-lg font-semibold text-red-600">{failed}</p>
            </div>
          </div>

          {failed > 0 && failedItems && failedItems.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">{t('document.bulk.resultDialog.failedItems')}</p>
              <ScrollArea className="h-40 rounded-md border p-2">
                <ul className="space-y-1 text-sm">
                  {failedItems.map((item) => (
                    <li key={item} className="text-destructive font-mono break-all">
                      {item}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            {t('document.bulk.resultDialog.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
