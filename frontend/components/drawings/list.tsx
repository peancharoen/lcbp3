"use client";

import { DrawingCard } from "@/components/drawings/card";
import { useDrawings } from "@/hooks/use-drawing";
import { Loader2 } from "lucide-react";

interface DrawingListProps {
  type: "CONTRACT" | "SHOP";
}

export function DrawingList({ type }: DrawingListProps) {
  const { data: drawings, isLoading, isError } = useDrawings(type, { type });

  // Note: The hook handles switching services based on type.
  // The params { type } might be redundant if getAll doesn't use it, but safe to pass.

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    return (
       <div className="text-center py-12 text-red-500">
         Failed to load drawings.
       </div>
    );
  }

  if (!drawings || drawings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
        No drawings found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {drawings.map((drawing: any) => (
        <DrawingCard key={drawing[type === 'CONTRACT' ? 'contract_drawing_id' : 'shop_drawing_id'] || drawing.id || drawing.drawing_id} drawing={drawing} />
      ))}
    </div>
  );
}
