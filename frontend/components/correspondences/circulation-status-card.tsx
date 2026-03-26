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
  correspondenceUuid: string;
}

const ROUTING_STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-500', label: 'Pending' },
  IN_PROGRESS: { icon: Circle, color: 'text-blue-500', label: 'In Progress' },
  COMPLETED: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed' },
  REJECTED: { icon: XCircle, color: 'text-red-500', label: 'Rejected' },
};

const CIRC_STATUS_CLASS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
};

function RoutingStep({ routing }: { routing: CirculationRouting }) {
  const meta = ROUTING_STATUS_META[routing.status] ?? ROUTING_STATUS_META.PENDING;
  const Icon = meta.icon;
  const assigneeName = routing.assignee
    ? `${routing.assignee.firstName ?? ''} ${routing.assignee.lastName ?? ''}`.trim() ||
      routing.assignee.username
    : '—';

  return (
    <div className="flex items-center gap-2 py-1">
      <Icon className={`h-3.5 w-3.5 shrink-0 ${meta.color}`} />
      <span className="text-xs flex-1 truncate">{assigneeName}</span>
      {routing.completedAt && (
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(routing.completedAt), 'dd MMM')}
        </span>
      )}
    </div>
  );
}

function CirculationItem({ circ }: { circ: Circulation }) {
  const statusClass = CIRC_STATUS_CLASS[circ.statusCode] ?? 'bg-gray-100 text-gray-700';
  const routings = circ.routings ?? [];

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-muted-foreground">{circ.circulationNo}</p>
          <p className="text-sm font-medium line-clamp-1">{circ.subject}</p>
        </div>
        <Badge className={`text-xs px-1.5 py-0 shrink-0 border-0 ${statusClass}`}>
          {circ.statusCode}
        </Badge>
      </div>

      {routings.length > 0 && (
        <div className="border-t pt-2 space-y-0.5">
          {routings.slice(0, 3).map((r) => (
            <RoutingStep key={r.id} routing={r} />
          ))}
          {routings.length > 3 && (
            <p className="text-xs text-muted-foreground pl-5">
              +{routings.length - 3} more assignees
            </p>
          )}
        </div>
      )}

      <Link href={`/circulation/${circ.uuid}`}>
        <Button variant="ghost" size="sm" className="w-full h-7 text-xs mt-1">
          View Details
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </Link>
    </div>
  );
}

export function CirculationStatusCard({ correspondenceUuid }: CirculationStatusCardProps) {
  const { data, isLoading } = useCirculationsByCorrespondence(correspondenceUuid);

  const circulations: Circulation[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
      ? data.data
      : [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
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
          circulations.map((circ) => (
            <CirculationItem key={circ.uuid} circ={circ} />
          ))
        )}

        <Link href={`/circulation/new?correspondenceUuid=${correspondenceUuid}`}>
          <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-1">
            <GitBranch className="h-3 w-3 mr-1.5" />
            New Circulation
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
