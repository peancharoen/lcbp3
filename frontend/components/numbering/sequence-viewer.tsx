"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Loader2 } from "lucide-react";
import { numberingApi } from "@/lib/api/numbering";
import { NumberingSequence } from "@/types/numbering";

export function SequenceViewer({ templateId }: { templateId: number }) {
  const [sequences, setSequences] = useState<NumberingSequence[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const data = await numberingApi.getSequences(templateId);
      setSequences(data);
    } catch (error) {
      console.error("Failed to fetch sequences", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (templateId) {
      fetchSequences();
    }
  }, [templateId]);

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Number Sequences</h3>
        <Button variant="outline" size="sm" onClick={fetchSequences} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by year, organization..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading && sequences.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No sequences found.</p>
          ) : (
            sequences.map((seq) => (
              <div
                key={seq.sequence_id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{seq.year}</span>
                    {seq.organization_code && (
                      <Badge>{seq.organization_code}</Badge>
                    )}
                    {seq.discipline_code && (
                      <Badge variant="outline">{seq.discipline_code}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current: {seq.current_number} | Last Generated:{" "}
                    {seq.last_generated_number}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  Updated {new Date(seq.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </Card>
  );
}
