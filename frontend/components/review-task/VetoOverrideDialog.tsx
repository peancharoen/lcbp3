'use client';

// File: components/review-task/VetoOverrideDialog.tsx
// PM Veto Override dialog — บังคับผ่าน RFA แม้มี Code 3 (T072.5)
import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface VetoOverrideDialogProps {
  rfaNumber: string;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

const MIN_REASON_LENGTH = 10;

export function VetoOverrideDialog({ rfaNumber, onConfirm, isLoading }: VetoOverrideDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');

  const isValid = reason.trim().length >= MIN_REASON_LENGTH;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm(reason.trim());
    setOpen(false);
    setReason('');
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setReason('');
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <AlertTriangle className="h-4 w-4 mr-1.5" />
          PM Override
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            PM Veto Override
          </DialogTitle>
          <DialogDescription>
            Override the Code 3 rejection for <strong>{rfaNumber}</strong> and force-approve.
            This action will be permanently logged in the audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="text-sm font-medium">Justification Reason *</label>
            <Textarea
              value={reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              placeholder="Provide a detailed reason for overriding the rejection (minimum 10 characters)..."
              className="mt-1.5 min-h-[100px]"
            />
            <p className={`text-xs mt-1 ${isValid ? 'text-green-600' : 'text-muted-foreground'}`}>
              {reason.trim().length}/{MIN_REASON_LENGTH} minimum characters
            </p>
          </div>

          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3">
            <p className="text-xs text-destructive font-medium">
              ⚠ This override is irreversible. All reviewers and stakeholders will be notified.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isValid || isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm Override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
