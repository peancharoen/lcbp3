import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: string }> = {
  DRAFT: { label: 'Draft', variant: 'secondary' },
  PENDING: { label: 'Pending', variant: 'warning' }, // Note: Shadcn/UI might not have 'warning' variant by default, may need custom CSS or use 'secondary'
  IN_REVIEW: { label: 'In Review', variant: 'default' }, // Using 'default' (primary) for In Review
  APPROVED: { label: 'Approved', variant: 'success' }, // Note: 'success' might need custom CSS
  REJECTED: { label: 'Rejected', variant: 'destructive' },
  CLOSED: { label: 'Closed', variant: 'outline' },
};

// Fallback for unknown statuses
const _defaultStatus = { label: 'Unknown', variant: 'outline' };

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, variant: 'default' };

  // Mapping custom variants to Shadcn Badge variants if needed
  // For now, we'll assume standard variants or rely on className overrides for colors
  let badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';
  let customClass = '';

  switch (config.variant) {
    case 'secondary':
      badgeVariant = 'secondary';
      break;
    case 'destructive':
      badgeVariant = 'destructive';
      break;
    case 'outline':
      badgeVariant = 'outline';
      break;
    case 'warning':
      badgeVariant = 'secondary'; // Fallback
      customClass = 'bg-warning hover:bg-warning/90 text-warning-foreground';
      break;
    case 'success':
      badgeVariant = 'default'; // Fallback
      customClass = 'bg-success hover:bg-success/90 text-success-foreground';
      break;
    case 'info':
      badgeVariant = 'default';
      customClass = 'bg-info hover:bg-info/90 text-info-foreground';
      break;
    default:
      badgeVariant = 'default';
  }

  return (
    <Badge variant={badgeVariant} className={cn('uppercase', customClass, className)}>
      {config.label}
    </Badge>
  );
}
