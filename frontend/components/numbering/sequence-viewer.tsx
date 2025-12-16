'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw } from 'lucide-react';
import { numberingApi, NumberSequence } from '@/lib/api/numbering';

export function SequenceViewer() {
  const [sequences, setSequences] = useState<NumberSequence[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const response = await numberingApi.getSequences();
      // Handle wrapped response { data: [...] } or direct array
      const data = Array.isArray(response) ? response : (response as { data?: NumberSequence[] })?.data ?? [];
      setSequences(data);
    } catch {
      console.error('Failed to fetch sequences');
      setSequences([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  const filteredSequences = sequences.filter(
    (s) =>
      s.year.toString().includes(search) ||
      s.projectId.toString().includes(search) ||
      s.typeId.toString().includes(search)
  );

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Number Counters</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSequences}
          disabled={loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="mb-4">
        <Input
          placeholder="Search by year, project, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        {filteredSequences.length === 0 && (
          <div className="text-center text-muted-foreground py-4">
            No sequences found
          </div>
        )}
        {filteredSequences.map((seq, index) => (
          <div
            key={`${seq.projectId}-${seq.typeId}-${seq.year}-${index}`}
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Year {seq.year}</span>
                <Badge variant="outline">Project: {seq.projectId}</Badge>
                <Badge>Type: {seq.typeId}</Badge>
                {seq.disciplineId > 0 && (
                  <Badge variant="secondary">Disc: {seq.disciplineId}</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">
                  Counter: {seq.lastNumber}
                </span>{' '}
                | Originator: {seq.originatorId} | Recipient:{' '}
                {seq.recipientOrganizationId === -1 ? 'All' : seq.recipientOrganizationId}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
