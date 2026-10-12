'use client';

import { Bot } from 'lucide-react';
import { RagChatWidget } from '../../../components/ai/RagChatWidget';
import { useProjectStore } from '../../../lib/stores/project-store';

export default function RagPage() {
  const { selectedProjectId } = useProjectStore();

  return (
    <div className="container mx-auto max-w-3xl space-y-6 py-8">
      <div className="flex items-center gap-2">
        <Bot className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-semibold">RAG — ค้นหาจากเอกสารโครงการ</h1>
      </div>

      {!selectedProjectId && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
          กรุณาเลือกโครงการก่อนใช้งาน RAG
        </div>
      )}

      {selectedProjectId ? (
        <RagChatWidget projectPublicId={selectedProjectId} />
      ) : (
        <p className="pt-4 text-center text-sm text-muted-foreground">
          เลือกโครงการก่อนเพื่อเริ่มถามคำถามกับ RAG pipeline ใหม่
        </p>
      )}
    </div>
  );
}
