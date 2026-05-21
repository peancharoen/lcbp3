// File: hooks/use-ai-status.ts
// Change Log
// - 2026-05-21: เพิ่ม TanStack Query hook สำหรับ polling สถานะ AI features.
// - 2026-05-21: เพิ่ม `useAiHealth` hook สำหรับ polling ข้อมูลสุขภาพของระบบ AI (T031).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import { adminAiService } from '@/lib/services/admin-ai.service';
import { useAuthStore } from '@/lib/stores/auth-store';

export const AI_STATUS_QUERY_KEY = ['ai', 'admin-settings'] as const;
export const AI_HEALTH_QUERY_KEY = ['ai', 'admin-health'] as const;
const AI_PERMISSION_QUERY_KEY = ['users', 'me', 'ai-permissions'] as const;
const AI_PERMISSIONS = ['ai.suggest', 'ai.rag_query', 'rag.query', 'ai.extract'];

const extractArrayData = <T>(value: unknown): T[] => {
  let current: unknown = value;
  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) return current as T[];
    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }
    current = (current as { data?: unknown }).data;
  }
  return Array.isArray(current) ? (current as T[]) : [];
};

/** Poll สถานะเปิด/ปิด AI features สำหรับ admin console และ soft fallback */
export function useAiStatus(enabled = true) {
  return useQuery({
    queryKey: AI_STATUS_QUERY_KEY,
    queryFn: adminAiService.getStatus,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    staleTime: 5_000,
  });
}

/** Poll สถานะ AI เฉพาะผู้ใช้ปัจจุบันที่มี AI permissions */
export function useCurrentUserAiStatus() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storedPermissions = useAuthStore((state) => state.user?.permissions);
  const permissionQuery = useQuery({
    queryKey: AI_PERMISSION_QUERY_KEY,
    queryFn: async () => {
      const response = await apiClient.get<unknown>('/users/me/permissions');
      return extractArrayData<string>(response.data);
    },
    enabled: isAuthenticated && !storedPermissions,
    staleTime: 5 * 60_000,
  });
  const permissions = storedPermissions ?? permissionQuery.data ?? [];
  const hasAiPermission = permissions.some((permission) => AI_PERMISSIONS.includes(permission));
  const statusQuery = useAiStatus(isAuthenticated && hasAiPermission);
  return {
    ...statusQuery,
    isLoading: permissionQuery.isLoading || statusQuery.isLoading,
    data: statusQuery.data
      ? {
          ...statusQuery.data,
          hasAiPermission,
          shouldShowBanner: hasAiPermission && statusQuery.data.aiFeaturesEnabled === false,
        }
      : undefined,
  };
}

/** Mutation สำหรับ Superadmin เปิด/ปิด AI features */
export function useToggleAiFeatures() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) => adminAiService.toggleFeatures(enabled),
    onSuccess: (settings) => {
      queryClient.setQueryData(AI_STATUS_QUERY_KEY, settings);
      queryClient.invalidateQueries({ queryKey: AI_STATUS_QUERY_KEY });
    },
  });
}

/** Hook สำหรับดึงสถานะสุขภาพและความเร็วของระบบ AI (Ollama, Qdrant, queues) */
export function useAiHealth(enabled = true) {
  return useQuery({
    queryKey: AI_HEALTH_QUERY_KEY,
    queryFn: adminAiService.getHealth,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    staleTime: 5_000,
  });
}
