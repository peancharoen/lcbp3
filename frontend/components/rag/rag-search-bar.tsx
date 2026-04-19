'use client';

import { useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { z } from 'zod';

const schema = z.object({
  question: z.string().min(1, 'กรุณาระบุคำถาม').max(500, 'คำถามต้องไม่เกิน 500 ตัวอักษร'),
});

interface RagSearchBarProps {
  onSearch: (question: string) => void;
  isLoading: boolean;
}

export function RagSearchBar({ onSearch, isLoading }: RagSearchBarProps) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = schema.safeParse({ question });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง');
      return;
    }
    setError(null);
    onSearch(question);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="ถามคำถามเกี่ยวกับเอกสารโครงการ..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            disabled={isLoading}
            maxLength={500}
          />
          {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
          <p className="mt-1 text-xs text-muted-foreground text-right">
            {question.length}/500
          </p>
        </div>
        <button
          type="submit"
          disabled={isLoading || question.trim().length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          ค้นหา
        </button>
      </div>
    </form>
  );
}
