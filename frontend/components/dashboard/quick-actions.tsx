"use client";

import { Button } from "@/components/ui/button";
import { PlusCircle, Upload, FileText } from "lucide-react";
import Link from "next/link";

export function QuickActions() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      <Link href="/rfas/new">
        <Button className="bg-blue-600 hover:bg-blue-700">
          <PlusCircle className="mr-2 h-4 w-4" />
          New RFA
        </Button>
      </Link>
      <Link href="/correspondences/new">
        <Button variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          New Correspondence
        </Button>
      </Link>
      <Link href="/drawings/upload">
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Upload Drawing
        </Button>
      </Link>
    </div>
  );
}
