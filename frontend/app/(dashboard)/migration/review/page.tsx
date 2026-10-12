// File: app/(dashboard)/migration/review/page.tsx
// Change Log:
// - 2026-05-22: Initial creation of Migration Review page with premium UI, pagination, status tabs, and strictly zero blank lines inside function bodies (T024)

'use client';

import React, { useState } from 'react';
import { useMigrationReviewQueue } from '@/hooks/use-migration-review';
import { MigrationReviewStatus } from '@/types/migration';
import { ReviewQueueTable } from '@/components/migration/review-queue-table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RefreshCw, BarChart2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function MigrationReviewPage() {
  const [statusFilter, setStatusFilter] = useState<MigrationReviewStatus | 'ALL'>(MigrationReviewStatus.PENDING);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { data, isLoading, isFetching, refetch } = useMigrationReviewQueue(
    statusFilter === 'ALL' ? undefined : statusFilter,
    currentPage,
    itemsPerPage
  );
  const items = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const handleTabChange = (value: string) => {
    setStatusFilter(value as MigrationReviewStatus | 'ALL');
    setCurrentPage(1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };
  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
            Migration Review Queue
          </h2>
          <p className="text-sm text-muted-foreground">
            จัดการรีวิวเอกสารที่ได้รับการย้ายข้อมูลจากระบบเดิมผ่าน AI Engine และกดยืนยันเพื่อบันทึกเข้าระบบจริง
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9 transition-colors hover:bg-accent/50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            <span>โหลดใหม่</span>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-warning/20 bg-gradient-to-br from-warning/10 to-transparent shadow-sm backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-warning">รอการตรวจสอบ (Pending)</CardTitle>
            <BarChart2 className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-warning">
              {statusFilter === MigrationReviewStatus.PENDING ? totalItems : '-'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">คิวเอกสารที่ต้องการการอนุมัติแบบมีส่วนร่วม</p>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-gradient-to-br from-success/10 to-transparent shadow-sm backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-success">นำเข้าเรียบร้อย (Imported)</CardTitle>
            <BarChart2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-success">
              {statusFilter === MigrationReviewStatus.IMPORTED ? totalItems : '-'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">เอกสารที่นำเข้าสู่ระบบจัดเก็บถาวรแล้ว</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/20 bg-gradient-to-br from-destructive/10 to-transparent shadow-sm backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-destructive">ปฏิเสธนำเข้า (Rejected)</CardTitle>
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-destructive">
              {statusFilter === MigrationReviewStatus.REJECTED ? totalItems : '-'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">เอกสารที่ปฎิเสธและต้องผ่านการตรวจสอบใหม่</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/10 to-transparent shadow-sm backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-semibold text-indigo-500">จำนวนทั้งหมดในระบบ (Total)</CardTitle>
            <BarChart2 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="font-mono text-2xl font-black text-indigo-500">
              {statusFilter === 'ALL' ? totalItems : '-'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">จำนวนรวมรายการย้ายข้อมูลในระบบคิว</p>
          </CardContent>
        </Card>
      </div>
      <Card className="border-muted bg-card shadow-lg backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-3">
          <div>
            <CardTitle className="text-lg font-bold">คิวเอกสารย้ายข้อมูล</CardTitle>
            <CardDescription className="text-xs">
              เลือกรายการเอกสารเพื่อตรวจสอบความสัมพันธ์และแท็กของโครงการ
            </CardDescription>
          </div>
          <Tabs value={statusFilter} onValueChange={handleTabChange} className="w-[450px]">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="PENDING" className="text-xs font-semibold">
                รอตรวจสอบ
              </TabsTrigger>
              <TabsTrigger value="IMPORTED" className="text-xs font-semibold">
                นำเข้าแล้ว
              </TabsTrigger>
              <TabsTrigger value="REJECTED" className="text-xs font-semibold">
                ปฏิเสธ
              </TabsTrigger>
              <TabsTrigger value="ALL" className="text-xs font-semibold">
                ทั้งหมด
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="pt-6">
          <ReviewQueueTable items={items} isLoading={isLoading} />
          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 pt-6">
              <div className="font-mono text-xs text-muted-foreground">
                แสดงหน้า {currentPage} จาก {totalPages} (ทั้งหมด {totalItems} รายการ)
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevPage}
                  disabled={currentPage === 1 || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 font-mono text-xs font-semibold">{currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages || isLoading}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
