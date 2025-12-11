"use client";

import { CorrespondenceDetail } from "@/components/correspondences/detail";
import { useCorrespondence } from "@/hooks/use-correspondence";
import { Loader2 } from "lucide-react";
import { notFound, useParams } from "next/navigation";

export default function CorrespondenceDetailPage() {
  const params = useParams();
  const id = Number(params?.id); // useParams returns string | string[]

  if (isNaN(id)) {
    // We can't use notFound() directly in client component render without breaking sometimes,
    // but typically it works. Better to handle gracefully or redirect.
    // For now, let's keep it or return 404 UI.
    // Actually notFound() is for server components mostly.
    // Let's just return our error UI if ID is invalid.
    return (
       <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-xl font-bold text-red-500">Invalid Correspondence ID</h1>
       </div>
    );
  }

  const { data: correspondence, isLoading, isError } = useCorrespondence(id);

  if (isLoading) {
    return (
       <div className="flex bg-muted/20 min-h-screen justify-center items-center">
          <Loader2 className="h-8 w-8 animate-spin" />
       </div>
    );
  }

  if (isError || !correspondence) {
    // Optionally handle 404 vs other errors differently, but for now simple handling
    return (
       <div className="flex flex-col items-center justify-center min-h-screen">
          <h1 className="text-xl font-bold text-red-500">Failed to load correspondence</h1>
          <p>Please try again later or verify the ID.</p>
       </div>
    );
  }

  return <CorrespondenceDetail data={correspondence} />;
}
