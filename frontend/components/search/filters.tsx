'use client';

import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchFilters as FilterType } from '@/types/search';

const DOC_TYPES = [
  { value: 'correspondence', label: 'Correspondence' },
  { value: 'rfa', label: 'RFA' },
  { value: 'drawing', label: 'Drawing' },
];

const STATUSES = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBOWN', label: 'Submitted' },
  { value: 'CLBOWN', label: 'Approved' },
  { value: 'CCBOWN', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface SearchFiltersProps {
  filters: FilterType;
  onFilterChange: (filters: FilterType) => void;
}

export function SearchFilters({ filters, onFilterChange }: SearchFiltersProps) {
  const activeCount = (filters.types?.length ?? 0) + (filters.statuses?.length ?? 0);

  const handleTypeChange = (type: string, checked: boolean) => {
    const current = filters.types || [];
    const next = checked ? [...current, type] : current.filter((t) => t !== type);
    onFilterChange({ ...filters, types: next });
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const current = filters.statuses || [];
    const next = checked ? [...current, status] : current.filter((s) => s !== status);
    onFilterChange({ ...filters, statuses: next });
  };

  const clearFilters = () => onFilterChange({ types: [], statuses: [] });

  return (
    <Card className="p-4 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Filters</h3>
        {activeCount > 0 && (
          <Badge variant="secondary" className="text-xs">{activeCount} active</Badge>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Document Type</p>
        <div className="space-y-2">
          {DOC_TYPES.map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${value}`}
                checked={filters.types?.includes(value)}
                onCheckedChange={(checked) => handleTypeChange(value, checked as boolean)}
              />
              <Label htmlFor={`type-${value}`} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Status</p>
        <div className="space-y-2">
          {STATUSES.map(({ value, label }) => (
            <div key={value} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${value}`}
                checked={filters.statuses?.includes(value)}
                onCheckedChange={(checked) => handleStatusChange(value, checked as boolean)}
              />
              <Label htmlFor={`status-${value}`} className="text-sm cursor-pointer">
                {label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearFilters}>
          Clear all filters
        </Button>
      )}
    </Card>
  );
}
