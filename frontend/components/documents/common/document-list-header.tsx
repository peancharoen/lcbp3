'use client';

// File: frontend/components/documents/common/document-list-header.tsx
// Change Log:
// - 2026-09-22: เพิ่ม field 'documentDate' (Issued Date) + prop compact สำหรับคอลัมน์แคบ
// - 2026-09-17: Shared URL-backed filter/sort header สำหรับ document lists

import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DocumentListHeaderProps {
  title: string;
  field: 'documentNumber' | 'revision' | 'createdAt' | 'status' | 'documentDate';
  filter?: 'text' | 'date' | 'status';
  statusOptions?: string[];
  /** คอลัมน์แคบ (เช่น Rev) — ลด min-width ของ header */
  compact?: boolean;
}

/** Header กลางที่เก็บ filter/sort ใน URL เพื่อให้ server query และ browser history ใช้ state เดียวกัน */
export function DocumentListHeader({ title, field, filter, statusOptions = [], compact = false }: DocumentListHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filterKey = field === 'createdAt' ? 'createdDate' : field;
  const [value, setValue] = useState(searchParams.get(filterKey) ?? '');
  const activeSort = searchParams.get('sortBy') === field;
  const sortOrder = activeSort ? searchParams.get('sortOrder') : null;

  const update = (changes: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(changes).forEach(([key, next]) => {
      if (next) params.set(key, next);
      else params.delete(key);
    });
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleSort = () => {
    const nextOrder = !activeSort || sortOrder === 'DESC' ? 'ASC' : 'DESC';
    update({ sortBy: field, sortOrder: nextOrder });
  };

  return (
    <div className={`${compact ? 'min-w-[64px]' : 'min-w-[120px]'} space-y-1`}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 -ml-2 px-2 font-medium"
        onClick={toggleSort}
        aria-label={`Sort ${title}`}
      >
        {title}
        {!activeSort ? (
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5" />
        ) : sortOrder === 'ASC' ? (
          <ArrowUp className="ml-1 h-3.5 w-3.5" />
        ) : (
          <ArrowDown className="ml-1 h-3.5 w-3.5" />
        )}
      </Button>
      {filter === 'status' ? (
        <Select
          value={value || '__all__'}
          onValueChange={(next) => {
            const normalized = next === '__all__' ? '' : next;
            setValue(normalized);
            update({ status: normalized });
          }}
        >
          <SelectTrigger className="h-7 text-xs" aria-label={`Filter ${title}`}>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All</SelectItem>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : filter ? (
        <div className="relative">
          <Input
            type={filter === 'date' ? 'date' : 'search'}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') update({ [filterKey]: value.trim() });
            }}
            onBlur={() => update({ [filterKey]: value.trim() })}
            className="h-7 pr-6 text-xs"
            aria-label={`Filter ${title}`}
          />
          {filter === 'text' && <Search className="absolute right-1.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      ) : null}
    </div>
  );
}
