// File: components/custom/responsive-data-table.tsx

import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Interface สำหรับ Column Definition
 */
export interface ColumnDef<T> {
  key: string;
  header: string;
  /** ฟังก์ชันสำหรับ render cell content (optional) */
  cell?: (item: T) => React.ReactNode;
  /** คลาส CSS เพิ่มเติมสำหรับ cell */
  className?: string;
}

/**
 * Props สำหรับ ResponsiveDataTable
 */
interface ResponsiveDataTableProps<T> {
  /** ข้อมูลที่จะแสดงในตาราง */
  data: T[];
  /** นิยามของคอลัมน์ */
  columns: ColumnDef<T>[];
  /** Key ที่เป็น Unique ID ของข้อมูล (เช่น 'id', 'user_id') */
  keyExtractor: (item: T) => string | number;
  /** ฟังก์ชันสำหรับ Render Card View บน Mobile (ถ้าไม่ใส่จะ Render แบบ Default Key-Value) */
  renderMobileCard?: (item: T) => React.ReactNode;
  /** ข้อความเมื่อไม่มีข้อมูล */
  emptyMessage?: string;
  /** คลาส CSS เพิ่มเติมสำหรับ Container */
  className?: string;
}

/**
 * ResponsiveDataTable Component
 * * แสดงผลเป็น Table ปกติในหน้าจอขนาด md ขึ้นไป
 * และแสดงผลเป็น Card List ในหน้าจอขนาดเล็กกว่า md
 */
export function ResponsiveDataTable<T>({
  data,
  columns,
  keyExtractor,
  renderMobileCard,
  emptyMessage = "ไม่พบข้อมูล",
  className,
}: ResponsiveDataTableProps<T>) {

  if (!data || data.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground border rounded-md bg-background">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* --- Desktop View (Table) --- */}
      <div className="hidden md:block rounded-md border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={keyExtractor(item)}>
                {columns.map((col) => (
                  <TableCell key={`${keyExtractor(item)}-${col.key}`} className={col.className}>
                    {col.cell ? col.cell(item) : (item as any)[col.key]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- Mobile View (Cards) --- */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          <div key={keyExtractor(item)}>
            {renderMobileCard ? (
              // Custom Mobile Render
              renderMobileCard(item)
            ) : (
              // Default Mobile Render (Key-Value Pairs)
              <Card>
                <CardHeader className="pb-2 font-semibold border-b mb-2">
                    # {keyExtractor(item)}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {columns.map((col) => (
                    <div key={col.key} className="flex justify-between items-start border-b pb-1 last:border-0">
                      <span className="font-medium text-muted-foreground w-1/3">{col.header}:</span>
                      <span className="text-right w-2/3 break-words">
                         {col.cell ? col.cell(item) : (item as any)[col.key]}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}