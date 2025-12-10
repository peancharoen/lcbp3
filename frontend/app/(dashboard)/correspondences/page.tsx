import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Loader2 } from "lucide-react";
import { CorrespondencesContent } from "@/components/correspondences/correspondences-content";

export const dynamic = "force-dynamic";

export default function CorrespondencesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Correspondences</h1>
          <p className="text-muted-foreground mt-1">
            Manage official letters and communications
          </p>
        </div>
        <Link href="/correspondences/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Correspondence
          </Button>
        </Link>
      </div>

      <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>}>
        <CorrespondencesContent />
      </Suspense>
    </div>
  );
}
