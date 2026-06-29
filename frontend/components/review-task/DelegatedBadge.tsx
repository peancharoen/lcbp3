'use client';

// File: components/review-task/DelegatedBadge.tsx
// แสดง indicator "Delegated from X" บน Review Task (T041)
import { ArrowRightLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

interface DelegatedBadgeProps {
  delegatedFromUser?: {
    publicId: string;
    fullName?: string;
    email?: string;
  };
}

export function DelegatedBadge({ delegatedFromUser }: DelegatedBadgeProps) {
  if (!delegatedFromUser) return null;

  const displayName = delegatedFromUser.fullName ?? delegatedFromUser.email ?? 'Unknown';

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge variant="outline" className="gap-1 text-xs text-muted-foreground border-dashed cursor-pointer">
          <ArrowRightLeft className="h-3 w-3" />
          Delegated
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-2">
        <p className="text-sm">Delegated from: <strong>{displayName}</strong></p>
      </HoverCardContent>
    </HoverCard>
  );
}
