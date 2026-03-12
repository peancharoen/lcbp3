"use client";

import { useEffect, useState } from "react";
import { migrationService } from "@/lib/services/migration.service";
import { MigrationErrorItem } from "@/types/migration";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MigrationErrorsPage() {
  const [items, setItems] = useState<MigrationErrorItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await migrationService.getErrors({ limit: 100 });
      setItems(res.items);
    } catch (error) {
      console.error("Failed to fetch errors", error);
    } finally {
      setLoading(false);
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
          <CardTitle>Error Audit Log</CardTitle>
        </CardHeader>
        <CardContent>
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
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-sm">{item.batchId || "-"}</TableCell>
                      <TableCell className="font-medium">{item.documentNumber || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">{item.errorType || "UNKNOWN"}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md break-words">
                        <span className="text-sm text-muted-foreground line-clamp-2" title={item.errorMessage}>
                          {item.errorMessage || "-"}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
