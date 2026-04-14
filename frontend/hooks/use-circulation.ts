import { useQuery } from '@tanstack/react-query';
import { circulationService } from '@/lib/services/circulation.service';
import { Circulation } from '@/types/circulation';

export const circulationKeys = {
  all: ['circulations'] as const,
  detail: (uuid: string) => ['circulations', 'detail', uuid] as const,
  byCorrespondence: (uuid: string) => ['circulations', 'byCorrespondence', uuid] as const,
};

/**
 * Hook สำหรับดึงข้อมูล Circulation รายเอกสาร (พร้อม workflowInstanceId)
 * ADR-021 / v1.8.7 — ใช้ใน circulation/[uuid]/page.tsx
 */
export function useCirculation(uuid: string | undefined) {
  const query = useQuery<Circulation>({
    queryKey: circulationKeys.detail(uuid ?? ''),
    queryFn: async () => {
      const res = await circulationService.getByUuid(uuid!);
      return (res?.data ?? res) as Circulation;
    },
    enabled: !!uuid,
    staleTime: 60_000,
  });

  return {
    circulation: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCirculationsByCorrespondence(correspondencePublicId: string) {
  return useQuery({
    queryKey: circulationKeys.byCorrespondence(correspondencePublicId),
    queryFn: () => circulationService.getByCorrespondenceUuid(correspondencePublicId),
    enabled: !!correspondencePublicId,
  });
}
