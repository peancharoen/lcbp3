'use client';

// File: components/documents/document-metadata-edit-dialog.tsx
// Feature 253 T024: Shared Metadata Edit Dialog — 3-tier field rendering

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
import { useTranslations } from '@/hooks/use-translations';
import { DocumentActionConfig } from './document-action-strategy';

export interface MetadataField {
  key: string;
  label: string;
  value: string;
  tier: 1 | 2 | 3;
}

export interface DocumentMetadataEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: DocumentActionConfig;
  documentLabel: string;
  currentVersion: number;
  fields: MetadataField[];
  isLoading?: boolean;
  onConfirm: (patch: Record<string, string>, version: number) => void;
}

export function DocumentMetadataEditDialog({
  open,
  onOpenChange,
  config,
  documentLabel,
  currentVersion,
  fields,
  isLoading = false,
  onConfirm,
}: DocumentMetadataEditDialogProps) {
  const t = useTranslations();
  const [values, setValues] = useState<Record<string, string>>({});
  const [tier2Confirmed, setTier2Confirmed] = useState(false);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const hasChanges = Object.keys(values).some(
    (key) => values[key] !== (fields.find((f) => f.key === key)?.value ?? ''),
  );

  const hasTier2Changes = fields.some(
    (f) => f.tier === 2 && values[f.key] !== undefined && values[f.key] !== f.value,
  );

  const canConfirm = hasChanges && (!hasTier2Changes || tier2Confirmed);

  const handleConfirm = () => {
    if (!canConfirm) return;
    const patch: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      if (value !== (fields.find((f) => f.key === key)?.value ?? '')) {
        patch[key] = value;
      }
    }
    onConfirm(patch, currentVersion);
    setValues({});
    setTier2Confirmed(false);
    onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setValues({});
      setTier2Confirmed(false);
    }
    onOpenChange(next);
  };

  const tier1Fields = fields.filter((f) => f.tier === 1);
  const tier2Fields = fields.filter((f) => f.tier === 2);
  const tier3Fields = fields.filter((f) => f.tier === 3);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('document.metadata.title')}</DialogTitle>
          <DialogDescription>
            {t(config.displayName)} — {documentLabel} (v{currentVersion})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {tier1Fields.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t('document.metadata.tier1')}
              </h4>
              {tier1Fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
                    value={values[field.key] ?? field.value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}

          {tier2Fields.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-amber-600">
                {t('document.metadata.tier2')}
              </h4>
              {tier2Fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
                    value={values[field.key] ?? field.value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                  />
                </div>
              ))}
              {hasTier2Changes && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={tier2Confirmed}
                    onChange={(e) => setTier2Confirmed(e.target.checked)}
                  />
                  {t('document.metadata.tier2Confirm')}
                </label>
              )}
            </div>
          )}

          {tier3Fields.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-destructive">
                {t('document.metadata.tier3')}
              </h4>
              <p className="text-sm text-muted-foreground">
                {t('document.metadata.tier3Hint')}
              </p>
              {tier3Fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  <Input
                    id={`field-${field.key}`}
                    value={values[field.key] ?? field.value}
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    disabled
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
          >
            {isLoading ? t('common.processing') : t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
