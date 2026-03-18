"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RevisionHistory } from "@/components/drawings/revision-history";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { contractDrawingService } from "@/lib/services/contract-drawing.service";
import { shopDrawingService } from "@/lib/services/shop-drawing.service";
import { asBuiltDrawingService } from "@/lib/services/asbuilt-drawing.service";

async function fetchDrawingByUuid(uuid: string) {
  // Try each drawing type until one succeeds
  try {
    const result = await contractDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: "CONTRACT" };
  } catch { /* not found in contract drawings */ }

  try {
    const result = await shopDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: "SHOP" };
  } catch { /* not found in shop drawings */ }

  try {
    const result = await asBuiltDrawingService.getByUuid(uuid);
    if (result?.data) return { ...result.data, _type: "AS_BUILT" };
  } catch { /* not found in asbuilt drawings */ }

  return null;
}

export default function DrawingDetailPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = use(params);

  const { data: drawing, isLoading } = useQuery({
    queryKey: ["drawing-detail", uuid],
    queryFn: () => fetchDrawingByUuid(uuid),
    enabled: !!uuid,
  });

  if (!uuid) {
    notFound();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!drawing) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/drawings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Drawing Not Found</h1>
        </div>
        <p className="text-muted-foreground">
          The drawing with UUID <code>{uuid}</code> could not be found.
        </p>
      </div>
    );
  }

  const drawingNumber = drawing.contractDrawingNo || drawing.drawingNumber || "N/A";
  const title = drawing.title || drawing.currentRevision?.title || "Untitled";
  const revisions = drawing.revisions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/drawings">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{drawingNumber}</h1>
            <p className="text-muted-foreground">{title}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Current
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">Drawing Details</CardTitle>
                <Badge>{drawing._type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Drawing Number</p>
                  <p className="font-medium mt-1">{drawingNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Type</p>
                  <p className="font-medium mt-1">{drawing._type}</p>
                </div>
                {drawing.volumePage && (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Volume Page</p>
                    <p className="font-medium mt-1">{drawing.volumePage}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Created</p>
                  <p className="font-medium mt-1">
                    {drawing.createdAt ? format(new Date(drawing.createdAt), "dd MMM yyyy") : "N/A"}
                  </p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Preview</h3>
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                  <div className="text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                    <p className="text-muted-foreground">PDF Preview Placeholder</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revisions */}
        <div className="space-y-6">
          <RevisionHistory revisions={revisions} />
        </div>
      </div>
    </div>
  );
}
