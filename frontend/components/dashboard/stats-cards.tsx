'use client';

import { Card } from '@/components/ui/card';
import { FileText, Clipboard, CheckCircle, Clock, CalendarDays, RefreshCw } from 'lucide-react';
import { DashboardStats } from '@/types/dashboard';

export interface StatsCardsProps {
  stats: DashboardStats | undefined;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(6)].map((_, i) => (
          <Card key={i} className="h-[100px] animate-pulse bg-muted p-6" />
        ))}
      </div>
    );
  }
  const cards = [
    {
      title: 'Total Correspondences',
      value: stats.totalDocuments,
      icon: FileText,
      color: 'text-info',
      bgColor: 'bg-info/10',
    },
    {
      title: 'Active RFAs',
      value: stats.totalRfas,
      icon: Clipboard,
      color: 'text-ai',
      bgColor: 'bg-ai/10',
    },
    {
      title: 'Total Circulations',
      value: stats.totalCirculations,
      icon: RefreshCw,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Documents This Month',
      value: stats.documentsThisMonth,
      icon: CalendarDays,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
    {
      title: 'Approved Documents',
      value: stats.approved,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: 'Pending Approvals',
      value: stats.pendingApprovals,
      icon: Clock,
      color: 'text-caution',
      bgColor: 'bg-caution/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <Card key={card.title} className="p-6 transition-shadow hover:shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                <p className="mt-2 text-3xl font-bold">{card.value}</p>
              </div>
              <div className={`rounded-lg p-3 ${card.bgColor}`}>
                <Icon className={`h-6 w-6 ${card.color}`} />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
