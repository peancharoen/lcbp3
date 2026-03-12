"use client";

import { useEffect, useState } from "react";
import { migrationService } from "@/lib/services/migration.service";
import { MigrationReviewQueueItem, MigrationReviewStatus } from "@/types/migration";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { EyeIcon, FileXIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MigrationReviewQueuePage() {
  const [items, setItems] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await migrationService.getReviewQueue({
        status: statusFilter === "ALL" ? undefined : (statusFilter as MigrationReviewStatus),
        limit: 50,
      });
      setItems(res.items);
    } catch (error) {
      console.error("Failed to fetch queue", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between flex-wrap gap-4 items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Migration Review Queue</h1>
          <p className="text-muted-foreground mt-1">
            Review and correct documents that AI flagged as low confidence.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/migration/errors">
            <Button variant="outline">
              <FileXIcon className="mr-2 h-4 w-4" /> View Error Logs
            </Button>
          </Link>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queue Items - {statusFilter}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">Loading queue...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No items in the queue.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document No.</TableHead>
                    <TableHead>Suggested Category</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.documentNumber}</TableCell>
                      <TableCell>{item.aiSuggestedCategory || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            !item.aiConfidence 
                              ? "destructive" 
                              : item.aiConfidence > 0.8 
                                ? "default" 
                                : item.aiConfidence > 0.5 
                                  ? "secondary" 
                                  : "destructive"
                          }
                        >
                          {item.aiConfidence ? (item.aiConfidence * 100).toFixed(1) + "%" : "N/A"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'PENDING' ? 'outline' : item.status === 'APPROVED' ? 'default' : 'destructive'}>
                          {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{format(new Date(item.createdAt), "dd MMM yyyy, HH:mm")}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/migration/review/${item.id}`}>
                          <Button size="sm" variant="ghost">
                            <EyeIcon className="h-4 w-4 mr-2" /> Review
                          </Button>
                        </Link>
                      </TableCell>
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
