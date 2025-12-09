"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { transmittalService } from "@/lib/services/transmittal.service";
import { Transmittal } from "@/types/transmittal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, RefreshCw, Printer } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

export default function TransmittalDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const { data: transmittal, isLoading, error } = useQuery<Transmittal>({
    queryKey: ["transmittal", id],
    queryFn: () => transmittalService.getById(id),
    enabled: !!id,
  });

  const handlePrint = () => {
    toast.info("PDF Export is coming soon...");
    // TODO: Implement PDF download
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !transmittal) {
    return (
      <div className="space-y-4">
        <Link href="/transmittals">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Transmittals
          </Button>
        </Link>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load transmittal details.
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/transmittals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{transmittal.transmittalNo}</h1>
            <p className="text-muted-foreground">{transmittal.subject}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Transmittal Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Purpose</p>
            <Badge variant="outline">{transmittal.purpose || "OTHER"}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">
              {format(new Date(transmittal.createdAt), "dd MMM yyyy")}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Generated From</p>
            {transmittal.correspondence ? (
              <Link
                href={`/correspondences/${transmittal.correspondenceId}`}
                className="font-medium text-primary hover:underline"
              >
                {transmittal.correspondence.correspondence_number}
              </Link>
            ) : (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
          {transmittal.remarks && (
            <div className="col-span-2">
              <p className="text-sm text-muted-foreground">Remarks</p>
              <p className="font-medium whitespace-pre-wrap">
                {transmittal.remarks}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Document ID/No.</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transmittal.items?.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Badge variant="secondary">{item.itemType}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.documentNumber || `ID: ${item.itemId}`}
                  </TableCell>
                  <TableCell>{item.description || "-"}</TableCell>
                </TableRow>
              ))}
              {(!transmittal.items || transmittal.items.length === 0) && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
                    No items in this transmittal
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </section>
  );
}
