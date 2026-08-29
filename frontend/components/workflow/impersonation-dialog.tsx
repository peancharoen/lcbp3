'use client';

// File: components/workflow/impersonation-dialog.tsx
// ADR-049 T048: Dialog เลือก handler + ระบุเหตุผลสำหรับ admin ทำ action แทนผู้อื่น

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslations } from '@/hooks/use-translations';

export interface ImpersonationHandler {
  publicId: string;
  name: string;
}

export interface ImpersonationDialogConfirmData {
  impersonatedUserId: string;
  impersonationReason: string;
}

export interface ImpersonationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handlers: ImpersonationHandler[];
  onConfirm: (data: ImpersonationDialogConfirmData) => void;
}

export function ImpersonationDialog({
  open,
  onOpenChange,
  handlers,
  onConfirm,
}: ImpersonationDialogProps) {
  const t = useTranslations();
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');

  const canConfirm = selected.length > 0 && reason.trim().length > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm({ impersonatedUserId: selected, impersonationReason: reason.trim() });
    setSelected('');
    setReason('');
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSelected('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('workflow.impersonation.title')}</DialogTitle>
          <DialogDescription>{t('workflow.impersonation.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="handler">{t('workflow.impersonation.handlerLabel')}</Label>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger id="handler">
                <SelectValue placeholder={t('workflow.impersonation.handlerPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {handlers.map((h) => (
                  <SelectItem key={h.publicId} value={h.publicId}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reason">{t('workflow.impersonation.reasonLabel')}</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('workflow.impersonation.reasonPlaceholder')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
