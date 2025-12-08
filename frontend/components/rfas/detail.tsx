"use client";

import { RFA } from "@/types/rfa";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";
import { useProcessRFA } from "@/hooks/use-rfa";

interface RFADetailProps {
  data: RFA;
}

export function RFADetail({ data }: RFADetailProps) {
  const router = useRouter();
  const [actionState, setActionState] = useState<"approve" | "reject" | null>(null);
  const [comments, setComments] = useState("");
  const processMutation = useProcessRFA();

  const handleProcess = () => {
    if (!actionState) return;

    const apiAction = actionState === "approve" ? "APPROVE" : "REJECT";

    processMutation.mutate(
      {
        id: data.rfa_id,
        data: {
          action: apiAction,
          comments: comments,
        },
      },
      {
        onSuccess: () => {
          setActionState(null);
          setComments("");
          // Query invalidation handled in hook
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header / Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/rfas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{data.rfa_number}</h1>
            <p className="text-muted-foreground">
              Created on {format(new Date(data.created_at), "dd MMM yyyy HH:mm")}
            </p>
          </div>
        </div>

        {data.status === "PENDING" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setActionState("reject")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setActionState("approve")}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve
            </Button>
          </div>
        )}
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

              <hr className="my-4 border-t" />

              <div>
                <h3 className="font-semibold mb-3">RFA Items</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Item No.</th>
                        <th className="px-4 py-3 text-left font-medium">Description</th>
                        <th className="px-4 py-3 text-right font-medium">Qty</th>
                        <th className="px-4 py-3 text-left font-medium">Unit</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium">{item.item_no}</td>
                          <td className="px-4 py-3">{item.description}</td>
                          <td className="px-4 py-3 text-right">{item.quantity}</td>
                          <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status || "PENDING"} className="text-[10px] px-2 py-0.5 h-5" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Contract</p>
                <p className="font-medium mt-1">{data.contract_name}</p>
              </div>

              <hr className="my-4 border-t" />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Discipline</p>
                <p className="font-medium mt-1">{data.discipline_name}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
