import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { SearchContractDrawingDto, CreateContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto, CreateShopDrawingDto } from '@/types/dto/drawing/shop-drawing.dto';
import { toast } from 'sonner';

type DrawingType = 'CONTRACT' | 'SHOP';
type DrawingSearchParams = SearchContractDrawingDto | SearchShopDrawingDto;
type CreateDrawingData = CreateContractDrawingDto | CreateShopDrawingDto;

export const drawingKeys = {
  all: ['drawings'] as const,
  lists: () => [...drawingKeys.all, 'list'] as const,
  list: (type: DrawingType, params: DrawingSearchParams) => [...drawingKeys.lists(), type, params] as const,
  details: () => [...drawingKeys.all, 'detail'] as const,
  detail: (type: DrawingType, id: number | string) => [...drawingKeys.details(), type, id] as const,
};

// --- Queries ---

export function useDrawings(type: DrawingType, params: DrawingSearchParams) {
  return useQuery({
    queryKey: drawingKeys.list(type, params),
    queryFn: async () => {
      if (type === 'CONTRACT') {
        return contractDrawingService.getAll(params as SearchContractDrawingDto);
      } else {
        return shopDrawingService.getAll(params as SearchShopDrawingDto);
      }
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useDrawing(type: DrawingType, id: number | string) {
  return useQuery({
    queryKey: drawingKeys.detail(type, id),
    queryFn: async () => {
      if (type === 'CONTRACT') {
        return contractDrawingService.getById(id);
      } else {
        return shopDrawingService.getById(id);
      }
    },
    enabled: !!id,
  });
}

// --- Mutations ---

export function useCreateDrawing(type: DrawingType) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateDrawingData) => {
      if (type === 'CONTRACT') {
        return contractDrawingService.create(data as CreateContractDrawingDto);
      } else {
        return shopDrawingService.create(data as CreateShopDrawingDto);
      }
    },
    onSuccess: () => {
      toast.success(`${type === 'CONTRACT' ? 'Contract' : 'Shop'} Drawing uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: drawingKeys.lists() });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error('Failed to upload drawing', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

// You can add useCreateShopDrawingRevision logic here if needed separate
