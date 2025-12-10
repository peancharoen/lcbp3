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
        const data = await numberingApi.getSequences();
        setSequences(data);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchSequences();
  }, []);

  const filteredSequences = sequences.filter(s =>
      s.year.toString().includes(search) ||
      s.organizationCode?.toLowerCase().includes(search.toLowerCase()) ||
      s.disciplineCode?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Number Sequences</h3>
        <Button variant="outline" size="sm" onClick={fetchSequences} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
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

      <div className="space-y-2">
        {filteredSequences.length === 0 && (
            <div className="text-center text-muted-foreground py-4">No sequences found</div>
        )}
        {filteredSequences.map((seq) => (
          <div
            key={seq.sequenceId}
            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded border"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium">Year {seq.year}</span>
                {seq.organizationCode && (
                  <Badge>{seq.organizationCode}</Badge>
                )}
                {seq.disciplineCode && (
                  <Badge variant="outline">{seq.disciplineCode}</Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="text-foreground font-medium">Current: {seq.currentNumber}</span> | Last Generated:{' '}
                <span className="font-mono">{seq.lastGeneratedNumber}</span>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              Updated {new Date(seq.updatedAt).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
