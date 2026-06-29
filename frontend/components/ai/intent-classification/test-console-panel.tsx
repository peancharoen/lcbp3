'use client';

// File: components/ai/intent-classification/test-console-panel.tsx
// Change Log
// - 2026-05-19: สร้าง Test Console Panel สำหรับทดสอบ Intent Classification (ADR-024).

import { useState } from 'react';
import { useClassifyIntent } from '@/hooks/ai/use-intent-classification';
import { ClassificationResultCard } from './classification-result-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Send } from 'lucide-react';
import type { ClassificationResult } from '@/lib/services/ai-intent.service';

/**
 * Test Console Panel — Admin/Developer ทดสอบ classification แบบ real-time
 */
export function TestConsolePanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<
    Array<{ query: string; result: ClassificationResult; timestamp: Date }>
  >([]);

  const classifyMutation = useClassifyIntent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    try {
      const result = await classifyMutation.mutateAsync({ query: trimmed });
      setResults((prev) => [
        { query: trimmed, result, timestamp: new Date() },
        ...prev,
      ]);
      setQuery('');
    } catch {
      // Error state จัดการโดย TanStack Query (classifyMutation.isError)
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Test Console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="พิมพ์คำถามเพื่อทดสอบ เช่น 'สรุปเอกสารนี้' หรือ 'show me RFA'"
            maxLength={200}
            disabled={classifyMutation.isPending}
          />
          <Button
            type="submit"
            disabled={!query.trim() || classifyMutation.isPending}
          >
            {classifyMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>

        {/* Error Display */}
        {classifyMutation.isError && (
          <p className="text-sm text-destructive">
            เกิดข้อผิดพลาด: ไม่สามารถเชื่อมต่อ AI ได้ กรุณาลองใหม่
          </p>
        )}

        {/* Results List */}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {results.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-8">
              พิมพ์คำถามด้านบนเพื่อทดสอบ Intent Classification
            </p>
          )}
          {results.map((item, idx) => (
            <ClassificationResultCard
              key={`${item.timestamp.getTime()}-${idx}`}
              query={item.query}
              result={item.result}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
