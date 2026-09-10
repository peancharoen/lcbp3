// File: frontend/hooks/use-rag-query.ts
// Change Log:
// - 2026-09-12: เพิ่ม TanStack Query hook สำหรับ RAG retrieval ตาม contract rag-retrieval.md
//   (Feature 254, Phase 4 US2, T043) — POST /api/ai/rag/query พร้อม Zod validation
//   และ Idempotency-Key; ไม่เปิดเผย generationUuid ตาม ADR-019

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import apiClient from '@/lib/api/client';
import { extractData } from '@/lib/api/ai';

/** ประเภท segment ของ chunk ตาม contract (ตรงกับ RagSegmentType ของ backend) */
export const RagSegmentTypeSchema = z.enum([
  'PAGE',
  'SECTION',
  'SHEET',
  'WHOLE_DOCUMENT',
]);

/** โหมด retrieval ตาม contract rag-retrieval.md (VECTOR | FULL_TEXT | HYBRID) */
export const RagRetrievalModeSchema = z.enum([
  'VECTOR',
  'FULL_TEXT',
  'HYBRID',
]);

export type RagRetrievalMode = z.infer<typeof RagRetrievalModeSchema>;
export type RagSegmentType = z.infer<typeof RagSegmentTypeSchema>;

/**
 * Schema สำหรับ citation ผลลัพธ์การค้นหา RAG ที่ปลอดภัยสำหรับ frontend
 * - ใช้ publicId เท่านั้น ไม่มี generationUuid ตาม ADR-019
 * - ตรวจโครงสร้าง field เท่านั้น (UUID format บังคับที่ backend DTO ด้วย @IsUUID)
 */
export const RagCitationSchema = z.object({
  attachmentPublicId: z.string().min(1),
  ownerType: z.string().min(1),
  ownerPublicId: z.string().min(1),
  sourceLocator: z.string().optional(),
  segmentType: RagSegmentTypeSchema,
  segmentNumber: z.number().nonnegative().optional(),
  segmentLabel: z.string().optional(),
  startOffset: z.string(),
  endOffset: z.string(),
  snippet: z.string(),
  score: z.number().nonnegative(),
  chunkPublicId: z.string().min(1),
});

export type RagCitation = z.infer<typeof RagCitationSchema>;

/**
 * Schema สำหรับ response ของ POST /api/ai/rag/query ตาม retrieval contract
 * - ไม่รวม generationUuid (contract ระบุว่าห้ามเปิดเผย)
 */
export const RagQueryResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(RagCitationSchema),
  retrievalMode: RagRetrievalModeSchema,
});

export type RagQueryResponse = z.infer<typeof RagQueryResponseSchema>;

/** พารามิเตอร์สำหรับเรียก RAG query */
export interface UseRagQueryParams {
  /** publicId ของโครงการเจ้าของ (บังคับ — Qdrant filter ตาม project_public_id) */
  projectPublicId: string;
  /** คำถาม/คำค้นของผู้ใช้ (ตาม contract field `query`) */
  query: string;
  /** จำนวนผลลัพธ์สูงสุด (optional ตาม contract) */
  topK?: number;
}

/** Query key factory สำหรับ cache invalidation */
export const ragQueryKeys = {
  all: ['rag-query'] as const,
  query: (projectPublicId: string, query: string) =>
    [...ragQueryKeys.all, projectPublicId, query] as const,
};

/**
 * Hook สำหรับส่งคำถามเข้า RAG retrieval API และ validate response ด้วย Zod
 *
 * การใช้งาน:
 * ```tsx
 * const { data, isLoading, isError } = useRagQuery({
 *   projectPublicId,
 *   query: 'ฉบับแก้ไขล่าสุดที่อนุมัติคืออะไร?',
 * });
 * ```
 *
 * - ส่ง POST /api/ai/rag/query พร้อม Idempotency-Key (UUID)
 * - validate response ด้วย Zod ก่อนคืนค่า (ป้องกัน malformed payload)
 * - ไม่เปิดเผย generationUuid ตาม ADR-019 (contract ระบุว่าห้าม)
 * - enabled เฉพาะเมื่อ projectPublicId และ query ไม่ว่าง
 */
export function useRagQuery(params: UseRagQueryParams) {
  const { projectPublicId, query, topK } = params;
  const enabled = projectPublicId.trim().length > 0 && query.trim().length > 0;

  return useQuery({
    queryKey: ragQueryKeys.query(projectPublicId, query),
    enabled,
    queryFn: async (): Promise<RagQueryResponse> => {
      const response = await apiClient.post(
        '/ai/rag/query',
        { projectPublicId, query, topK },
        {
          headers: {
            'Idempotency-Key': crypto.randomUUID(),
          },
        }
      );
      const unwrapped = extractData<unknown>(response.data);
      return RagQueryResponseSchema.parse(unwrapped);
    },
    staleTime: 0,
  });
}
