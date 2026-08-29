'use client';

// File: components/rfa/rfa-action-panel.tsx
// ADR-049 T049: RFA action panel รวมปุ่ม action ตาม state + impersonation dialog สำหรับ admin

import { useState } from 'react';
import { IntegratedBanner } from '@/components/workflow/integrated-banner';
import { ImpersonationDialog, ImpersonationHandler } from '@/components/workflow/impersonation-dialog';
import { Button } from '@/components/ui/button';
import { useProcessRFA } from '@/hooks/use-rfa';
import { useTranslations } from '@/hooks/use-translations';
import { UserCheck, XCircle } from 'lucide-react';

export interface RfaActionPanelProps {
  uuid: string;
  docNo: string;
  subject: string;
  status: string;
  workflowState?: string;
  availableActions?: string[];
  handlers?: ImpersonationHandler[];
  /** เปิดปุ่ม impersonation เมื่อ user มีสิทธิ์ admin */
  isAdmin?: boolean;
  isLoading?: boolean;
}

export function RfaActionPanel({
  uuid,
  docNo,
  subject,
  status,
  workflowState,
  availableActions = [],
  handlers = [],
  isAdmin = false,
  isLoading = false,
}: RfaActionPanelProps) {
  const t = useTranslations();
  const mutation = useProcessRFA();
  const [impersonationOpen, setImpersonationOpen] = useState(false);
  const [pendingImpersonation, setPendingImpersonation] = useState<{
    impersonatedUserId: string;
    impersonationReason: string;
  } | null>(null);

  const handleImpersonationConfirm = (data: { impersonatedUserId: string; impersonationReason: string }) => {
    setPendingImpersonation(data);
    setImpersonationOpen(false);
  };

  const clearImpersonation = () => {
    setPendingImpersonation(null);
  };

  const handleAction = (action: string, comment?: string) => {
    const payload: {
      action: string;
      comments?: string;
      impersonatedUserId?: string;
      impersonationReason?: string;
    } = {
      action,
      comments: comment,
    };

    if (pendingImpersonation) {
      payload.impersonatedUserId = pendingImpersonation.impersonatedUserId;
      payload.impersonationReason = pendingImpersonation.impersonationReason;
    }

    mutation.mutate({ uuid, data: payload });
  };

  return (
    <div className="space-y-2">
      <IntegratedBanner
        docNo={docNo}
        subject={subject}
        status={status}
        workflowState={workflowState}
        availableActions={availableActions}
        onAction={handleAction}
        isLoading={isLoading || mutation.isPending}
      />

      {isAdmin && (
        <div className="flex items-center gap-2">
          {pendingImpersonation ? (
            <>
              <span className="text-sm text-muted-foreground">
                {t('workflow.impersonation.actingOnBehalf')}:{' '}
                {handlers.find((h) => h.publicId === pendingImpersonation.impersonatedUserId)?.name ??
                  pendingImpersonation.impersonatedUserId}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={clearImpersonation}>
                <XCircle className="h-4 w-4 mr-1" />
                {t('common.clear')}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImpersonationOpen(true)}
              disabled={handlers.length === 0}
            >
              <UserCheck className="h-4 w-4 mr-1" />
              {t('workflow.impersonation.actionOnBehalf')}
            </Button>
          )}
        </div>
      )}

      <ImpersonationDialog
        open={impersonationOpen}
        onOpenChange={setImpersonationOpen}
        handlers={handlers}
        onConfirm={handleImpersonationConfirm}
      />
    </div>
  );
}
