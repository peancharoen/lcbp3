'use client';

// File: components/response-code/CodeImplications.tsx
// แสดงผลกระทบของ Response Code ที่เลือก (FR-007)
import { AlertTriangle, Clock, DollarSign, FileText, Leaf } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ResponseCode } from '@/types/review-team';

interface CodeImplicationsProps {
  responseCode: ResponseCode;
}

const SEVERITY_VARIANTS = {
  '3': { variant: 'destructive' as const, label: 'Critical — Document Rejected' },
  '1C': { variant: 'default' as const, label: 'High — Contract Implications' },
  '1D': { variant: 'default' as const, label: 'High — Alternative Approved' },
  '2': { variant: 'default' as const, label: 'Moderate — Revision Required' },
};

export function CodeImplications({ responseCode }: CodeImplicationsProps) {
  const impl = responseCode.implications;
  const notifyRoles = responseCode.notifyRoles ?? [];

  const hasImplications =
    impl?.affectsSchedule ||
    impl?.affectsCost ||
    impl?.requiresContractReview ||
    impl?.requiresEiaAmendment ||
    notifyRoles.length > 0;

  if (!hasImplications) return null;

  const severityInfo = SEVERITY_VARIANTS[responseCode.code as keyof typeof SEVERITY_VARIANTS];

  return (
    <Alert variant={severityInfo?.variant ?? 'default'} className="mt-2">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="font-semibold">
        {severityInfo?.label ?? 'Action Required'}
      </AlertTitle>
      <AlertDescription>
        <div className="space-y-1 mt-1">
          {impl?.affectsSchedule && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              <span>May affect project schedule</span>
            </div>
          )}
          {impl?.affectsCost && (
            <div className="flex items-center gap-2 text-sm">
              <DollarSign className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Cost impact — QS assessment required</span>
            </div>
          )}
          {impl?.requiresContractReview && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Contract review required</span>
            </div>
          )}
          {impl?.requiresEiaAmendment && (
            <div className="flex items-center gap-2 text-sm">
              <Leaf className="h-3.5 w-3.5 flex-shrink-0" />
              <span>EIA amendment may be required</span>
            </div>
          )}
          {notifyRoles.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap mt-1">
              <span className="text-xs text-muted-foreground">Will notify:</span>
              {notifyRoles.map((role) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
