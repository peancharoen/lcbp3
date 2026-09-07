'use client';

// File: components/documents/document-row-actions.tsx
// Feature 253 T025: Shared Row Action Dropdown — ⋯ menu with CASL permission filtering

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from '@/hooks/use-translations';
import { useAuthStore } from '@/lib/stores/auth-store';
import { DocumentActionConfig } from './document-action-strategy';

export interface DocumentRowActionsProps {
  config: DocumentActionConfig;
  onCancel: () => void;
  onHardDelete: () => void;
  onMetadataEdit: () => void;
}

export function DocumentRowActions({
  config,
  onCancel,
  onHardDelete,
  onMetadataEdit,
}: DocumentRowActionsProps) {
  const t = useTranslations();
  const { hasPermission } = useAuthStore();
  const [open, setOpen] = useState(false);

  const canCancel = hasPermission(`${config.apiBasePath}.cancel`) ||
    hasPermission('document.cancel');
  const canHardDelete = hasPermission(`${config.apiBasePath}.delete`) ||
    hasPermission('system.manage_all');
  const canEditMetadata = hasPermission(`${config.apiBasePath}.edit_metadata`) ||
    hasPermission(`${config.apiBasePath}.edit`);

  if (!canCancel && !canHardDelete && !canEditMetadata) {
    return null;
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{t('common.actions')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditMetadata && (
          <DropdownMenuItem onClick={onMetadataEdit}>
            {t('document.metadata.title')}
          </DropdownMenuItem>
        )}
        {canCancel && (
          <>
            {canEditMetadata && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={onCancel}
              className="text-amber-600 focus:text-amber-600"
            >
              {t('document.cancel.title')}
            </DropdownMenuItem>
          </>
        )}
        {canHardDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onHardDelete}
              className="text-destructive focus:text-destructive"
            >
              {t('document.hardDelete.title')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
