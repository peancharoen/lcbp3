"use client";

import { DrawingRevision } from "@/types/drawing";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { format } from "date-fns";

export function RevisionHistory({ revisions }: { revisions: DrawingRevision[] }) {
  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Revision History</h3>

      <div className="space-y-3">
        {revisions.map((rev) => (
          <div
            key={rev.revision_id}
            className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <Badge variant={rev.is_current ? "default" : "outline"}>
                  Rev. {rev.revision_number}
                </Badge>
                {rev.is_current && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                    CURRENT
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground font-medium">
                {rev.revision_description || "No description"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(rev.revision_date), "dd MMM yyyy")} by{" "}
                {rev.revised_by_name}
              </p>
            </div>

            <Button variant="ghost" size="sm" title="Download">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}
