'use client';

// File: components/distribution/DistributionStatus.tsx
// แสดงสถานะ Distribution ของ RFA หลังอนุมัติ (T060)
import React from 'react';
import { CheckCircle2, Clock, SendHorizonal, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type DistributionStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface DistributionRecord {
  publicId: string;
  status: DistributionStatus;
  transmittalCount: number;
  recipientCount: number;
  processedAt?: string;
  error?: string;
}

interface DistributionStatusProps {
  rfaPublicId: string;
  distribution?: DistributionRecord;
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<
  DistributionStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }
> = {
  PENDING: { label: 'Queued', variant: 'outline', icon: Clock },
  PROCESSING: { label: 'Processing', variant: 'secondary', icon: Clock },
  COMPLETED: { label: 'Distributed', variant: 'default', icon: CheckCircle2 },
  FAILED: { label: 'Failed', variant: 'destructive', icon: Clock },
};

export function DistributionStatus({ rfaPublicId: _rfaPublicId, distribution, isLoading }: DistributionStatusProps) {
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Checking distribution status...</div>;
  }

  if (!distribution) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Awaiting approval for distribution</span>
      </div>
    );
  }

  const config = STATUS_CONFIG[distribution.status];
  const Icon = config.icon;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">Distribution Status</CardTitle>
          <Badge variant={config.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <SendHorizonal className="h-3.5 w-3.5" />
            <span>{distribution.transmittalCount} Transmittal(s)</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{distribution.recipientCount} Recipient(s)</span>
          </div>
          {distribution.processedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(distribution.processedAt).toLocaleDateString('th-TH')}
            </span>
          )}
        </div>
        {distribution.error && (
          <p className="mt-1 text-xs text-destructive">{distribution.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
