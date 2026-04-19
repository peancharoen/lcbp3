'use client';

import { Bot } from 'lucide-react';
import { useRagQuery } from '../../../hooks/use-rag';
import { useProjectStore } from '../../../lib/stores/project-store';
import { RagSearchBar } from '../../../components/rag/rag-search-bar';
import { RagResultCard } from '../../../components/rag/rag-result-card';

export default function RagPage() {
  const { selectedProjectId } = useProjectStore();
  const { mutate, data, isPending, error, isIdle } = useRagQuery();

  const handleSearch = (question: string) => {
    if (!selectedProjectId) return;
    mutate({ question, projectPublicId: selectedProjectId });
  };

  return (
    <div className="container mx-auto max-w-3xl py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">RAG — ค้นหาจากเอกสารโครงการ</h1>
      </div>

      {!selectedProjectId && (
        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-700">
          กรุณาเลือกโครงการก่อนใช้งาน RAG
        </div>
      )}

      <RagSearchBar onSearch={handleSearch} isLoading={isPending} />

      {isPending && (
        <div className="rounded-lg border bg-card p-6 text-center text-sm text-muted-foreground animate-pulse">
          กำลังค้นหาและประมวลผล...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          เกิดข้อผิดพลาด: {error.message}
        </div>
      )}

      {data && !isPending && <RagResultCard result={data} />}

      {isIdle && !error && (
        <p className="text-center text-sm text-muted-foreground pt-4">
          พิมพ์คำถามแล้วกด ค้นหา เพื่อรับคำตอบจากเอกสารโครงการ
        </p>
      )}
    </div>
  );
}
