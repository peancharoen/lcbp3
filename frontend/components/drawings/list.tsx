"use client";

import { Drawing } from "@/types/drawing";
import { DrawingCard } from "@/components/drawings/card";
import { drawingApi } from "@/lib/api/drawings";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface DrawingListProps {
  type: "CONTRACT" | "SHOP";
}

export function DrawingList({ type }: DrawingListProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDrawings = async () => {
      setLoading(true);
      try {
        const data = await drawingApi.getAll({ type });
        setDrawings(data);
      } catch (error) {
        console.error("Failed to fetch drawings", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDrawings();
  }, [type]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (drawings.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
        No drawings found.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {drawings.map((drawing) => (
        <DrawingCard key={drawing.drawing_id} drawing={drawing} />
      ))}
    </div>
  );
}
