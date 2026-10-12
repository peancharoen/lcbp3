'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, GitBranch, ChevronRight, CheckCircle2, Clock, XCircle, Circle } from 'lucide-react';
import { useCirculationsByCorrespondence } from '@/hooks/use-circulation';
import { Circulation, CirculationRouting } from '@/types/circulation';
import { format } from 'date-fns';
import Link from 'next/link';

interface CirculationStatusCardProps {
  correspondencePublicId: string;
}

const ROUTING_STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-warning', label: 'Pending' },
  IN_PROGRESS: { icon: Circle, color: 'text-info', label: 'In Progress' },
  COMPLETED: { icon: CheckCircle2, color: 'text-success', label: 'Completed' },
  REJECTED: { icon: XCircle, color: 'text-destructive', label: 'Rejected' },
};

const CIRC_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-info/10 text-info',
  COMPLETED: 'bg-success/10 text-success',
  CANCELLED: 'bg-muted text-muted-foreground',
};

function RoutingStep({ routing }: { routing: CirculationRouting }) {
  const meta = ROUTING_STATUS_META[routing.status] ?? ROUTING_STATUS_META.PENDING;
  const Icon = meta.icon;
  const assigneeName = routing.assignee
    ? `${routing.assignee.firstName ?? ''} ${routing.assignee.lastName ?? ''}`.trim() || routing.assignee.username
    : '—';

  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
      <span className="flex-1 truncate text-xs">{assigneeName}</span>
      {routing.completedAt && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {format(new Date(routing.completedAt), 'dd MMM')}
        </span>
      )}
    </div>
  );
}

function CirculationItem({ circ }: { circ: Circulation }) {
  const statusClass = CIRC_STATUS_CLASS[circ.statusCode] ?? 'bg-muted text-foreground';
  const routings = circ.routings ?? [];

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">{circ.circulationNo}</p>
          <p className="line-clamp-1 text-sm font-medium">{circ.subject}</p>
        </div>
        <Badge className={`shrink-0 border-0 px-1.5 py-0 text-xs ${statusClass}`}>{circ.statusCode}</Badge>
      </div>

      {routings.length > 0 && (
        <div className="space-y-0.5 border-t pt-2">
          {routings.slice(0, 3).map((r) => (
            <RoutingStep key={r.id} routing={r} />
          ))}
          {routings.length > 3 && (
            <p className="pl-5 text-xs text-muted-foreground">+{routings.length - 3} more assignees</p>
          )}
        </div>
      )}

      <Link href={`/circulation/${circ.publicId}`}>
        <Button variant="ghost" size="sm" className="mt-1 h-7 w-full text-xs">
          View Details
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

export function CirculationStatusCard({ correspondencePublicId }: CirculationStatusCardProps) {
  const { data, isLoading } = useCirculationsByCorrespondence(correspondencePublicId);

  const circulations: Circulation[] = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <GitBranch className="h-4 w-4" />
          Circulations
          {circulations.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {circulations.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading...
          </div>
        ) : circulations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No circulations yet</p>
        ) : (
          circulations.map((circ) => <CirculationItem key={circ.publicId} circ={circ} />)
        )}

        <Link href={`/circulation/new?correspondencePublicId=${correspondencePublicId}`}>
          <Button variant="outline" size="sm" className="mt-1 h-8 w-full text-xs">
            <GitBranch className="mr-1.5 h-3 w-3" />
            New Circulation
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
