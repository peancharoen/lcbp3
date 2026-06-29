// File: hooks/use-transmittal.ts
// ADR-021 / v1.8.7: TanStack Query hook สำหรับ Transmittal detail page
import { useQuery } from '@tanstack/react-query';
import { transmittalService } from '@/lib/services/transmittal.service';
import { Transmittal } from '@/types/transmittal';

export const transmittalKeys = {
  all: ['transmittals'] as const,
  detail: (uuid: string) => ['transmittals', 'detail', uuid] as const,
};

/**
 * Hook สำหรับดึงข้อมูล Transmittal รายเอกสาร (พร้อม workflowInstanceId)
 * ใช้ใน transmittals/[uuid]/page.tsx
 */
export function useTransmittal(uuid: string | undefined) {
  const query = useQuery<Transmittal>({
    queryKey: transmittalKeys.detail(uuid ?? ''),
    queryFn: async () => {
      const res = await transmittalService.getByUuid(uuid!);
      return (res?.data ?? res) as Transmittal;
    },
    enabled: !!uuid,
    staleTime: 60_000,
  });

  return {
    transmittal: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
