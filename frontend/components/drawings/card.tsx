"use client";

import { Drawing } from "@/types/drawing";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Eye, GitCompare } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export function DrawingCard({ drawing }: { drawing: Drawing }) {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex gap-4">
        {/* Thumbnail Placeholder */}
        <div className="w-24 h-24 bg-muted rounded flex items-center justify-center shrink-0">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h3 className="text-lg font-semibold truncate" title={drawing.drawingNumber}>
                {drawing.drawingNumber}
              </h3>
              <p className="text-sm text-muted-foreground truncate" title={drawing.title}>
                {drawing.title}
              </p>
            </div>
            <Badge variant="outline">{typeof drawing.discipline === 'object' ? drawing.discipline?.disciplineCode : drawing.discipline}</Badge>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
            <div>
              <span className="font-medium text-foreground">Sheet:</span> {drawing.sheetNumber}
            </div>
            <div>
              <span className="font-medium text-foreground">Rev:</span> {drawing.revision}
            </div>
            <div>
              <span className="font-medium text-foreground">Scale:</span> {drawing.scale || "N/A"}
            </div>
            <div>
              <span className="font-medium text-foreground">Date:</span>{" "}
              {drawing.issueDate && format(new Date(drawing.issueDate), "dd/MM/yyyy")}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Link href={`/drawings/${drawing.drawingId}`}>
              <Button variant="outline" size="sm">
                <Eye className="mr-2 h-4 w-4" />
                View
              </Button>
            </Link>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            {(drawing.revisionCount || 0) > 1 && (
              <Button variant="outline" size="sm">
                <GitCompare className="mr-2 h-4 w-4" />
                Compare
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
