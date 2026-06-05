'use client';

import { Bot } from 'lucide-react';
import { RagChatWidget } from '../../../components/ai/RagChatWidget';
import { useProjectStore } from '../../../lib/stores/project-store';

export default function RagPage() {
  const { selectedProjectId } = useProjectStore();

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

      {selectedProjectId ? (
        <RagChatWidget projectPublicId={selectedProjectId} />
      ) : (
        <p className="text-center text-sm text-muted-foreground pt-4">
          เลือกโครงการก่อนเพื่อเริ่มถามคำถามกับ RAG pipeline ใหม่
        </p>
      )}
    </div>
  );
}
