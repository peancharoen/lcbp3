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
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { EyeIcon, FileXIcon, CheckSquareIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getApiErrorMessage } from "@/types/api-error";

export default function MigrationReviewQueuePage() {
  const [items, setItems] = useState<MigrationReviewQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      const res = await migrationService.getReviewQueue({
        status: statusFilter === "ALL" ? undefined : (statusFilter as MigrationReviewStatus),
        limit: 50,
      });
      setItems(Array.isArray(res.items) ? res.items : []);
      setSelectedIds([]); // reset selection on fetch
    } catch (error: unknown) {
      setItems([]);
      setErrorMessage(getApiErrorMessage(error, "Failed to load queue"));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);

      const batchItems = items
        .filter((i) => selectedIds.includes(i.id))
        .map((item) => ({
          queueId: item.id,
          dto: {
            document_number: item.documentNumber,
            subject: item.title || item.originalTitle || 'Untitled',
            category: item.aiSuggestedCategory || 'Correspondence',
            project_id: item.projectId || 1,
            migrated_by: 'SYSTEM_IMPORT',
            temp_attachment_id: item.tempAttachmentId,
            ai_confidence: item.aiConfidence,
            ai_issues: item.aiIssues,
            issued_date: item.issuedDate,
            received_date: item.receivedDate,
            sender_id: item.senderOrganizationId,
            receiver_id: item.receiverOrganizationId,
            details: {
              tags: item.extractedTags
            }
          }
        }));

      const batchId = `BATCH_UI_${Date.now()}`;
      await migrationService.commitBatch(
        { items: batchItems, batchId },
        batchId
      );

      fetchData();
    } catch (error) {
      toast.error("Batch commit failed.");
    } finally {
      setSubmitting(false);
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
          {selectedIds.length > 0 && (
            <Button
              variant="default"
              onClick={handleBatchApprove}
              disabled={submitting}
            >
              <CheckSquareIcon className="mr-2 h-4 w-4" />
              {submitting ? "Processing..." : `Batch Approve (${selectedIds.length})`}
            </Button>
          )}
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
          {errorMessage && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </div>
          )}
          {loading ? (
            <div className="py-10 text-center">Loading queue...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">No items in the queue.</div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onCheckedChange={handleToggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
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
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(item.id)}
                          onCheckedChange={() => handleToggleSelect(item.id)}
                          aria-label={`Select item ${item.id}`}
                        />
                      </TableCell>
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
