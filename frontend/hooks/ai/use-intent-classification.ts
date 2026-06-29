// File: hooks/ai/use-intent-classification.ts
// Change Log
// - 2026-05-19: สร้าง TanStack Query hooks สำหรับ Intent Classification (ADR-024).
// Hooks สำหรับ Intent Classification — ใช้ TanStack Query

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  aiIntentService,
  IntentCategory,
  CreateIntentDefinitionDto,
  UpdateIntentDefinitionDto,
  CreateIntentPatternDto,
  UpdateIntentPatternDto,
  ClassificationAnalytics,
} from '@/lib/services/ai-intent.service';

// === Query Keys ===
const KEYS = {
  definitions: ['ai', 'intent-definitions'] as const,
  definition: (code: string) => ['ai', 'intent-definitions', code] as const,
  patterns: (code: string) => ['ai', 'intent-patterns', code] as const,
  analytics: ['ai', 'intent-analytics'] as const,
};

// === Query Hooks ===

/** ดึง Intent Definitions ทั้งหมด */
export function useIntentDefinitions(params?: {
  category?: IntentCategory;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: [...KEYS.definitions, params],
    queryFn: () => aiIntentService.getDefinitions(params),
  });
}

/** ดึง Intent Definition ตาม intentCode */
export function useIntentDefinition(intentCode: string) {
  return useQuery({
    queryKey: KEYS.definition(intentCode),
    queryFn: () => aiIntentService.getDefinition(intentCode),
    enabled: !!intentCode,
  });
}

/** ดึง Patterns ตาม intentCode */
export function useIntentPatterns(intentCode: string) {
  return useQuery({
    queryKey: KEYS.patterns(intentCode),
    queryFn: () => aiIntentService.getPatterns(intentCode),
    enabled: !!intentCode,
  });
}

// === Mutation Hooks ===

/** สร้าง Intent Definition ใหม่ */
export function useCreateIntentDefinition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIntentDefinitionDto) =>
      aiIntentService.createDefinition(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.definitions });
    },
  });
}

/** อัปเดต Intent Definition */
export function useUpdateIntentDefinition(intentCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateIntentDefinitionDto) =>
      aiIntentService.updateDefinition(intentCode, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.definitions });
      queryClient.invalidateQueries({ queryKey: KEYS.definition(intentCode) });
    },
  });
}

/** สร้าง Pattern ใหม่ */
export function useCreateIntentPattern(intentCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIntentPatternDto) =>
      aiIntentService.createPattern(intentCode, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.patterns(intentCode) });
    },
  });
}

/** อัปเดต Pattern */
export function useUpdateIntentPattern(intentCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { publicId: string; dto: UpdateIntentPatternDto }) =>
      aiIntentService.updatePattern(data.publicId, data.dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.patterns(intentCode) });
    },
  });
}

/** ลบ Pattern (soft delete) */
export function useDeleteIntentPattern(intentCode: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (publicId: string) => aiIntentService.deletePattern(publicId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEYS.patterns(intentCode) });
    },
  });
}

/** ดึง Classification Analytics */
export function useIntentAnalytics(params?: { from?: string; to?: string }) {
  return useQuery<ClassificationAnalytics>({
    queryKey: [...KEYS.analytics, params],
    queryFn: () => aiIntentService.getAnalytics(params),
    staleTime: 60_000, // 1 นาที cache
  });
}

/** Classify query (สำหรับ Test Console) */
export function useClassifyIntent() {
  return useMutation({
    mutationFn: (data: { query: string; projectPublicId?: string }) =>
      aiIntentService.classify(data.query, data.projectPublicId),
  });
}
