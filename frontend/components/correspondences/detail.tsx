"use client";

import { Correspondence } from "@/types/correspondence";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Loader2, Send, CheckCircle, XCircle, Edit } from "lucide-react";
import Link from "next/link";
import { useSubmitCorrespondence, useProcessWorkflow } from "@/hooks/use-correspondence";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface CorrespondenceDetailProps {
  data: Correspondence;
}

export function CorrespondenceDetail({ data }: CorrespondenceDetailProps) {
  const submitMutation = useSubmitCorrespondence();
  const processMutation = useProcessWorkflow();
  const [actionState, setActionState] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");

  if (!data) return <div>No data found</div>;

  console.log("Correspondence Detail Data:", data);

  // Derive Current Revision Data
  const currentRevision = data.revisions?.find(r => r.isCurrent) || data.revisions?.[0];
  const subject = currentRevision?.subject || "-";
  const description = currentRevision?.description || "-";
  const status = currentRevision?.status?.statusCode || "UNKNOWN"; // e.g. DRAFT
  const attachments = currentRevision?.attachments || [];

  // Note: Importance might be in details
  const importance = currentRevision?.details?.importance || "NORMAL";

  const handleSubmit = () => {
    if (confirm("Are you sure you want to submit this correspondence?")) {
      submitMutation.mutate({
        id: data.id,
        data: {}
      });
    }
  };

  const handleProcess = () => {
    if (!actionState) return;

    const action = actionState === "approve" ? "APPROVE" : "REJECT";
    processMutation.mutate({
      id: data.id,
      data: {
        action,
        comments
      }
    }, {
      onSuccess: () => {
        setActionState(null);
        setComments("");
      }
    });
  };

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
            <h1 className="text-2xl font-bold">{data.correspondenceNumber}</h1>
            <p className="text-muted-foreground">
              Created on {data.createdAt ? format(new Date(data.createdAt), "dd MMM yyyy HH:mm") : '-'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
           {/* EDIT BUTTON LOGIC: Show if DRAFT */}
          {status === "DRAFT" && (
             <Link href={`/correspondences/${data.id}/edit`}>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
             </Link>
          )}

          {status === "DRAFT" && (
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit for Review
            </Button>
          )}
          {status === "IN_REVIEW" && (
            <>
              <Button
                variant="destructive"
                onClick={() => setActionState("reject")}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setActionState("approve")}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Action Input Area */}
      {actionState && (
        <Card className="border-primary">
          <CardHeader>
             <CardTitle className="text-lg">
               {actionState === "approve" ? "Confirm Approval" : "Confirm Rejection"}
             </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
               <Label>Comments</Label>
               <Textarea
                 value={comments}
                 onChange={(e) => setComments(e.target.value)}
                 placeholder="Enter comments..."
               />
             </div>
             <div className="flex justify-end gap-2">
               <Button variant="ghost" onClick={() => setActionState(null)}>Cancel</Button>
               <Button
                 variant={actionState === "approve" ? "default" : "destructive"}
                 onClick={handleProcess}
                 disabled={processMutation.isPending}
                 className={actionState === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
               >
                 {processMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                 Confirm {actionState === "approve" ? "Approve" : "Reject"}
               </Button>
             </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{subject}</CardTitle>
                <StatusBadge status={status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {description}
                </p>
              </div>

              {currentRevision?.body && (
                <div>
                  <h3 className="font-semibold mb-2">Content</h3>
                  <div className="text-gray-700 whitespace-pre-wrap p-3 bg-muted/10 rounded-md border">
                    {currentRevision.body}
                  </div>
                </div>
              )}

              {currentRevision?.remarks && (
                <div>
                  <h3 className="font-semibold mb-2">Remarks</h3>
                  <p className="text-gray-600 italic">
                    {currentRevision.remarks}
                  </p>
                </div>
              )}

              <hr className="my-4 border-t" />

              <div>
                <h3 className="font-semibold mb-3">Attachments</h3>
                {attachments && attachments.length > 0 ? (
                  <div className="grid gap-2">
                    {attachments.map((file, index) => (
                      <div
                        key={file.id || index}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="h-5 w-5 text-primary" />
                          <span className="text-sm font-medium">{file.name}</span>
                        </div>
                        <Button variant="ghost" size="sm" asChild>
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No attachments found.</p>
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
                    ${importance === 'URGENT' ? 'bg-red-100 text-red-800' :
                      importance === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'}`}>
                    {importance}
                  </span>
                </div>
              </div>

              <hr className="my-4 border-t" />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Originator</p>
                <p className="font-medium mt-1">{data.originator?.organizationName || '-'}</p>
                <p className="text-xs text-muted-foreground">{data.originator?.organizationCode || '-'}</p>
              </div>

               <div>
                <p className="text-sm font-medium text-muted-foreground">Project</p>
                <p className="font-medium mt-1">{data.project?.projectName || '-'}</p>
                <p className="text-xs text-muted-foreground">{data.project?.projectCode || '-'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
