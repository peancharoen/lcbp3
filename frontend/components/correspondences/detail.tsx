"use client";

import { Correspondence } from "@/types/correspondence";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ArrowLeft, Download, FileText } from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface CorrespondenceDetailProps {
  data: Correspondence;
}

export function CorrespondenceDetail({ data }: CorrespondenceDetailProps) {
  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/correspondences">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.document_number}</h1>
            <p className="text-muted-foreground">
              Created on {format(new Date(data.created_at), "dd MMM yyyy HH:mm")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Workflow Actions Placeholder */}
          {data.status === "DRAFT" && (
            <Button>Submit for Review</Button>
          )}
          {data.status === "IN_REVIEW" && (
            <>
              <Button variant="destructive">Reject</Button>
              <Button className="bg-green-600 hover:bg-green-700">Approve</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{data.subject}</CardTitle>
                <StatusBadge status={data.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {data.description || "No description provided."}
                </p>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-3">Attachments</h3>
                {data.attachments && data.attachments.length > 0 ? (
                  <div className="grid gap-2">
                    {data.attachments.map((file: any, index: number) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{file.name || `Attachment ${index + 1}`}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No attachments.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Importance</p>
                <div className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    ${data.importance === 'URGENT' ? 'bg-red-100 text-red-800' :
                      data.importance === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'}`}>
                    {data.importance}
                  </span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground">From Organization</p>
                <p className="font-medium mt-1">{data.from_organization?.org_name}</p>
                <p className="text-xs text-muted-foreground">{data.from_organization?.org_code}</p>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">To Organization</p>
                <p className="font-medium mt-1">{data.to_organization?.org_name}</p>
                <p className="text-xs text-muted-foreground">{data.to_organization?.org_code}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
