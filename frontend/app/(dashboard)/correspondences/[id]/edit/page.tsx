"use client";

import { CorrespondenceForm } from "@/components/correspondences/form";
import { useCorrespondence } from "@/hooks/use-correspondence";
import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

export default function EditCorrespondencePage() {
  const params = useParams();
  const id = Number(params?.id);

  const { data: correspondence, isLoading, isError } = useCorrespondence(id);

  if (isLoading) {
    return (
       <div className="flex bg-muted/20 min-h-screen justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
       </div>
    );
  }

  if (isError || !correspondence) {
    return (
       <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-xl font-bold text-red-500">Failed to load correspondence</h1>
       </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Edit Correspondence</h1>
        <p className="text-muted-foreground mt-1">
          {correspondence.correspondenceNumber}
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 shadow-sm">
        <CorrespondenceForm initialData={correspondence} id={id} />
      </div>
    </div>
  );
}
