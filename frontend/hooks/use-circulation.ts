import { useQuery } from '@tanstack/react-query';
import { circulationService } from '@/lib/services/circulation.service';

export const circulationKeys = {
  all: ['circulations'] as const,
  byCorrespondence: (uuid: string) => ['circulations', 'byCorrespondence', uuid] as const,
};

export function useCirculationsByCorrespondence(correspondenceUuid: string) {
  return useQuery({
    queryKey: circulationKeys.byCorrespondence(correspondenceUuid),
    queryFn: () => circulationService.getByCorrespondenceUuid(correspondenceUuid),
    enabled: !!correspondenceUuid,
  });
}
