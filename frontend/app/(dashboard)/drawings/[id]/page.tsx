import { drawingApi } from "@/lib/api/drawings";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, FileText, GitCompare } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RevisionHistory } from "@/components/drawings/revision-history";
import { format } from "date-fns";

export default async function DrawingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = parseInt(rawId);
  if (isNaN(id)) {
    notFound();
  }

  const drawing = await drawingApi.getById(id);

  if (!drawing) {
    notFound();
  }

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
            <h1 className="text-2xl font-bold">{drawing.drawingNumber}</h1>
            <p className="text-muted-foreground">
              {drawing.title}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Download Current
          </Button>
          {(drawing.revisionCount ?? 0) > 1 && (
            <Button variant="outline">
              <GitCompare className="mr-2 h-4 w-4" />
              Compare Revisions
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">Drawing Details</CardTitle>
                <Badge>{drawing.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Discipline</p>
                  <p className="font-medium mt-1">
                    {typeof drawing.discipline === 'object' && drawing.discipline
                      ? `${drawing.discipline.disciplineName} (${drawing.discipline.disciplineCode})`
                      : drawing.discipline || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Sheet Number</p>
                  <p className="font-medium mt-1">{drawing.sheetNumber}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scale</p>
                  <p className="font-medium mt-1">{drawing.scale || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Latest Issue Date</p>
                  <p className="font-medium mt-1">{drawing.issueDate ? format(new Date(drawing.issueDate), "dd MMM yyyy") : 'N/A'}</p>
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
          <RevisionHistory revisions={drawing.revisions || []} />
        </div>
      </div>
    </div>
  );
}
