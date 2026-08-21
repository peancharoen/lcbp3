'use client';

import { useEffect, useState, useCallback } from 'react';
import { migrationService } from '@/lib/services/migration.service';
import { MigrationErrorItem } from '@/types/migration';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { ArrowLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiErrorMessage } from '@/types/api-error';
import { toast } from 'sonner';

export default function MigrationErrorsPage() {
  const [items, setItems] = useState<MigrationErrorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [batchFilter, setBatchFilter] = useState<string>('ALL');
  const [batchOptions, setBatchOptions] = useState<string[]>([]);
  // Pagination
  const [page, setPage] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await migrationService.getErrors({ page, limit: pageSize });
      let fetchedItems = Array.isArray(res.items) ? res.items : [];
      // ADR-047: filter by batchId ฝั่ง client
      if (batchFilter !== 'ALL') {
        fetchedItems = fetchedItems.filter((i) => i.batchId === batchFilter);
      }
      setItems(fetchedItems);
      setTotalRows(res.total ?? fetchedItems.length);
      setTotalPages(res.totalPages ?? 1);
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, 'Failed to load errors'));
    } finally {
      setLoading(false);
    }
  }, [batchFilter, page]);

  const fetchBatches = useCallback(async () => {
    try {
      const batches = await migrationService.getErrorBatches();
      setBatchOptions(batches);
    } catch {
      setBatchOptions([]);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // ADR-047: ลบ errors ตาม batch หรือทั้งหมด
  const handleDeleteByBatch = async () => {
    const isAll = batchFilter === 'ALL';
    const confirmMsg = isAll
      ? 'ยืนยันลบ error records ทั้งหมด?'
      : `ยืนยันลบ error records ใน batch ${batchFilter}?`;
    if (!window.confirm(confirmMsg)) return;
    try {
      setDeleting(true);
      const result = await migrationService.deleteErrors(
        isAll ? undefined : batchFilter,
        isAll
      );
      toast.success(`ลบ ${result.deleted} รายการเรียบร้อย`);
      await fetchData();
      await fetchBatches();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'ลบไม่สำเร็จ'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-red-600">Migration Errors</h1>
          <p className="text-muted-foreground mt-1">
            Systemic errors encountered during the background migration process.
          </p>
        </div>
        <Link href="/admin/migration">
          <Button variant="outline">
            <ArrowLeftIcon className="mr-2 h-4 w-4" /> Back to Queue
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap justify-between items-center gap-4">
            <CardTitle>Error Audit Log</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <Select value={batchFilter} onValueChange={setBatchFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Batch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Batches</SelectItem>
                  {batchOptions.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                onClick={handleDeleteByBatch}
                disabled={deleting || items.length === 0}
                size="sm"
              >
                {deleting ? 'กำลังลบ...' : `ลบ ${batchFilter === 'ALL' ? 'ทั้งหมด' : 'Batch นี้'}`}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {errorMessage && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center">Loading errors...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No errors found.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch ID</TableHead>
                    <TableHead>Document No.</TableHead>
                    <TableHead>Error Type</TableHead>
                    <TableHead>Error Message</TableHead>
                    <TableHead>Occurred At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    // ADR-019: ใช้ publicId เป็น key ห้ามใช้ INT id
                    <TableRow key={item.publicId ?? `${item.batchId}-${item.documentNumber}`}>
                      <TableCell className="font-mono text-sm">{item.batchId || '-'}</TableCell>
                      <TableCell className="font-medium">{item.documentNumber || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{item.errorType || 'UNKNOWN'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md break-words">
                        <span className="text-sm text-muted-foreground line-clamp-2" title={item.errorMessage}>
                          {item.errorMessage || '-'}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(item.createdAt), 'dd MMM yyyy, HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {/* Pagination + row count */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              ทั้งหมด {totalRows} รายการ (หน้า {page}/{totalPages})
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ก่อนหน้า
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ถัดไป
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
