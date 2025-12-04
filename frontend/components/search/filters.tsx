"use client";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { SearchFilters as FilterType } from "@/types/search";
import { useState } from "react";

interface SearchFiltersProps {
  onFilterChange: (filters: FilterType) => void;
}

export function SearchFilters({ onFilterChange }: SearchFiltersProps) {
  const [filters, setFilters] = useState<FilterType>({
    types: [],
    statuses: [],
  });

  const handleTypeChange = (type: string, checked: boolean) => {
    const currentTypes = filters.types || [];
    const newTypes = checked
      ? [...currentTypes, type]
      : currentTypes.filter((t) => t !== type);

    const newFilters = { ...filters, types: newTypes };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleStatusChange = (status: string, checked: boolean) => {
    const currentStatuses = filters.statuses || [];
    const newStatuses = checked
      ? [...currentStatuses, status]
      : currentStatuses.filter((s) => s !== status);

    const newFilters = { ...filters, statuses: newStatuses };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const newFilters = { types: [], statuses: [] };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  return (
    <Card className="p-4 space-y-6">
      <div>
        <h3 className="font-semibold mb-3">Document Type</h3>
        <div className="space-y-2">
          {["correspondence", "rfa", "drawing"].map((type) => (
            <div key={type} className="flex items-center space-x-2">
              <Checkbox
                id={`type-${type}`}
                checked={filters.types?.includes(type)}
                onCheckedChange={(checked) => handleTypeChange(type, checked as boolean)}
              />
              <Label htmlFor={`type-${type}`} className="text-sm capitalize">
                {type}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Status</h3>
        <div className="space-y-2">
          {["DRAFT", "PENDING", "APPROVED", "REJECTED", "IN_REVIEW"].map((status) => (
            <div key={status} className="flex items-center space-x-2">
              <Checkbox
                id={`status-${status}`}
                checked={filters.statuses?.includes(status)}
                onCheckedChange={(checked) => handleStatusChange(status, checked as boolean)}
              />
              <Label htmlFor={`status-${status}`} className="text-sm capitalize">
                {status.replace("_", " ").toLowerCase()}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={clearFilters}
      >
        Clear Filters
      </Button>
    </Card>
  );
}
