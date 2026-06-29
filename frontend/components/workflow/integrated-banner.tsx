'use client';

// ADR-021: IntegratedBanner — แสดง metadata เอกสาร + สถานะ Workflow + ปุ่ม Action ในแถวเดียว
// ใช้ใน RFA, Correspondence, Transmittal, Circulation detail pages

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { CheckCircle2, XCircle, RotateCcw, MessageSquare, Loader2, AlertTriangle } from 'lucide-react';
import { WorkflowPriority } from '@/types/workflow';
import { useWorkflowAction } from '@/hooks/use-workflow-action';
import { useTranslations } from '@/hooks/use-translations';

// สีของ Priority Badge (label ถูก resolve ผ่าน t() ใน component)
const PRIORITY_CONFIG: Record<WorkflowPriority, { labelKey: string; className: string }> = {
  URGENT: { labelKey: 'workflow.priority.URGENT', className: 'bg-red-600 text-white animate-pulse' },
  HIGH:   { labelKey: 'workflow.priority.HIGH',   className: 'bg-orange-500 text-white' },
  MEDIUM: { labelKey: 'workflow.priority.MEDIUM', className: 'bg-yellow-500 text-white' },
  LOW:    { labelKey: 'workflow.priority.LOW',    className: 'bg-green-600 text-white' },
};

// สีของ Status Badge
function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = status?.toUpperCase();
  if (['APPROVED', 'COMPLETED', 'ISSUED'].includes(s)) return 'default';
  if (['REJECTED', 'CANCELLED'].includes(s)) return 'destructive';
  if (['DRAFT', 'DFT'].includes(s)) return 'secondary';
  return 'outline';
}

// แสดงป้ายสีตาม Workflow State
function getStateColor(state?: string): string {
  if (!state) return 'text-muted-foreground';
  const s = state.toUpperCase();
  if (s.includes('APPROV') || s.includes('COMPLET') || s.includes('ISSUED')) return 'text-green-600';
  if (s.includes('REJECT') || s.includes('CANCEL')) return 'text-red-600';
  if (s.includes('REVIEW') || s.includes('PENDING') || s.includes('IN_')) return 'text-blue-600';
  return 'text-amber-600';
}

// Action button config (label ถูก resolve ผ่าน t() ใน component)
const ACTION_CONFIG: Record<string, { labelKey: string; icon: React.ReactNode; variant: 'default' | 'destructive' | 'outline' | 'secondary'; requiresComment: boolean }> = {
  APPROVE:     { labelKey: 'workflow.action.APPROVE',     icon: <CheckCircle2 className="h-4 w-4" />, variant: 'default',     requiresComment: false },
  REJECT:      { labelKey: 'workflow.action.REJECT',      icon: <XCircle className="h-4 w-4" />,      variant: 'destructive', requiresComment: true  },
  RETURN:      { labelKey: 'workflow.action.RETURN',      icon: <RotateCcw className="h-4 w-4" />,    variant: 'outline',     requiresComment: true  },
  ACKNOWLEDGE: { labelKey: 'workflow.action.ACKNOWLEDGE', icon: <CheckCircle2 className="h-4 w-4" />, variant: 'secondary',   requiresComment: false },
  COMMENT:     { labelKey: 'workflow.action.COMMENT',     icon: <MessageSquare className="h-4 w-4" />, variant: 'outline',     requiresComment: true  },
};

export interface IntegratedBannerProps {
  docNo: string;
  subject: string;
  status: string;
  priority?: WorkflowPriority;
  workflowState?: string;
  availableActions?: string[];
  /** Legacy prop — ใช้เมื่อไม่มี instanceId (Transmittal, Circulation) */
  onAction?: (action: string, comment?: string) => void;
  isLoading?: boolean;
  // ADR-021 T029: Workflow action wiring
  instanceId?: string;
  /** publicIds ของไฟล์ที่ user อัปโหลดใน WorkflowLifecycle Upload Zone */
  pendingAttachmentIds?: string[];
  /** เรียกเมื่อ action สำเร็จ (optional — React Query เปิด invalidate อัตโนมัติ) */
  onActionSuccess?: () => void;
}

// Action button พร้อม Popover สำหรับ Comment
function ActionButton({
  actionKey,
  onAction,
  disabled,
  t,
}: {
  actionKey: string;
  onAction: (action: string, comment?: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const config = ACTION_CONFIG[actionKey] ?? {
    labelKey: actionKey,
    icon: null,
    variant: 'outline' as const,
    requiresComment: false,
  };

  const handleSubmit = () => {
    onAction(actionKey, comment || undefined);
    setComment('');
    setOpen(false);
  };

  if (!config.requiresComment) {
    return (
      <Button
        size="sm"
        variant={config.variant}
        disabled={disabled}
        onClick={() => onAction(actionKey)}
      >
        {config.icon}
        <span className="ml-1">{t(config.labelKey)}</span>
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant={config.variant} disabled={disabled}>
          {config.icon}
          <span className="ml-1">{t(config.labelKey)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-3">
          <p className="text-sm font-medium">{t('workflow.action.commentLabel')}</p>
          <Textarea
            placeholder={t('workflow.action.commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
              {t('workflow.action.cancel')}
            </Button>
            <Button size="sm" variant={config.variant} onClick={handleSubmit}>
              {t('workflow.action.confirm')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function IntegratedBanner({
  docNo,
  subject,
  status,
  priority,
  workflowState,
  availableActions,
  onAction,
  isLoading = false,
  instanceId,
  pendingAttachmentIds,
  onActionSuccess,
}: IntegratedBannerProps) {
  const t = useTranslations();
  // ADR-021 T029: hook สำหรับ Workflow transition (disabled อัตโนมัติถ้าไม่มี instanceId)
  const wfMutation = useWorkflowAction(instanceId);

  // ถ้ามี instanceId ใช้ hook, ถ้าไม่มี fallback ไปยัง legacy onAction prop
  const handleAction = (action: string, comment?: string) => {
    if (instanceId) {
      wfMutation.mutate(
        { action, comment, attachmentPublicIds: pendingAttachmentIds ?? [] },
        { onSuccess: onActionSuccess }
      );
    } else {
      onAction?.(action, comment);
    }
  };

  const isBusy = isLoading || wfMutation.isPending;
  const priorityConfig = priority ? PRIORITY_CONFIG[priority] : undefined;
  const hasActions = availableActions && availableActions.length > 0 && (instanceId || onAction);

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm">
      {/* แถวหลัก */}
      <div className="flex flex-wrap items-center gap-3 min-w-0">
        {/* เลขที่เอกสาร + หัวข้อ */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground shrink-0">{docNo || '—'}</span>
            <Separator orientation="vertical" className="h-4 hidden sm:block" />
            <span className="text-sm text-muted-foreground truncate">{subject || '—'}</span>
          </div>
        </div>

        {/* Badges + Actions */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Status Badge */}
          <Badge variant={getStatusVariant(status)} className="text-xs">
            {status || '—'}
          </Badge>

          {/* Priority Badge */}
          {priorityConfig && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${priorityConfig.className}`}>
              <AlertTriangle className="h-3 w-3" />
              {t(priorityConfig.labelKey)}
            </span>
          )}

          {/* Workflow State */}
          {workflowState && (
            <span className={`text-xs font-medium ${getStateColor(workflowState)}`}>
              [{workflowState}]
            </span>
          )}

          {/* Action Buttons — แสดง spinner เมื่อ mutation กำลัง pending */}
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            hasActions &&
            availableActions!.map((actionKey) => (
              <ActionButton
                key={actionKey}
                actionKey={actionKey}
                onAction={handleAction}
                disabled={isBusy}
                t={t}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
