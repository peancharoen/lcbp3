import { useQuery } from '@tanstack/react-query';
import { circulationService } from '@/lib/services/circulation.service';

export const circulationKeys = {
  all: ['circulations'] as const,
  byCorrespondence: (uuid: string) => ['circulations', 'byCorrespondence', uuid] as const,
};

export function useCirculationsByCorrespondence(correspondencePublicId: string) {
  return useQuery({
    queryKey: circulationKeys.byCorrespondence(correspondencePublicId),
    queryFn: () => circulationService.getByCorrespondenceUuid(correspondencePublicId),
    enabled: !!correspondencePublicId,
  });
}
