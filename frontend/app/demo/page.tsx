"use client";

import { useState } from "react";
import { DataTable } from "@/components/common/data-table";
import { FileUpload } from "@/components/common/file-upload";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Mock Data for Table
interface Payment {
  id: string;
  amount: number;
  status: string;
  email: string;
}

const columns: ColumnDef<Payment>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("amount"));
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount);
      return <div className="font-medium">{formatted}</div>;
    },
  },
];

const data: Payment[] = [
  { id: "1", amount: 100, status: "PENDING", email: "m@example.com" },
  { id: "2", amount: 200, status: "APPROVED", email: "test@example.com" },
  { id: "3", amount: 300, status: "REJECTED", email: "fail@example.com" },
  { id: "4", amount: 400, status: "IN_REVIEW", email: "review@example.com" },
  { id: "5", amount: 500, status: "DRAFT", email: "draft@example.com" },
];

export default function DemoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(1);

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Common Components Demo</h1>

      {/* Status Badges */}
      <Card>
        <CardHeader>
          <CardTitle>Status Badges</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4 flex-wrap">
          <StatusBadge status="DRAFT" />
          <StatusBadge status="PENDING" />
          <StatusBadge status="IN_REVIEW" />
          <StatusBadge status="APPROVED" />
          <StatusBadge status="REJECTED" />
          <StatusBadge status="CLOSED" />
          <StatusBadge status="UNKNOWN" />
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <FileUpload
            onFilesSelected={(files) => setFiles(files)}
            maxFiles={3}
          />
          <div className="mt-4">
            <h3 className="font-semibold">Selected Files:</h3>
            <ul className="list-disc pl-5">
              {files.map((f, i) => (
                <li key={i}>
                  {f.name} ({(f.size / 1024).toFixed(2)} KB)
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Table</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={data} />
        </CardContent>
      </Card>

      {/* Pagination */}
      <Card>
        <CardHeader>
          <CardTitle>Pagination</CardTitle>
        </CardHeader>
        <CardContent>
          <Pagination
            currentPage={page}
            totalPages={10}
            total={100}
          />
          {/* Note: In a real app, clicking pagination would update 'page' via URL or state */}
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Card>
        <CardHeader>
          <CardTitle>Confirmation Dialog</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setDialogOpen(true)}>Open Dialog</Button>
          <ConfirmDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            title="Are you sure?"
            description="This action cannot be undone. This will permanently delete your account and remove your data from our servers."
            onConfirm={() => {
              alert("Confirmed!");
              setDialogOpen(false);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
