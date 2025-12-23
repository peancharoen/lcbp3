import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { asBuiltDrawingService } from '@/lib/services/asbuilt-drawing.service'; // Added
import { SearchContractDrawingDto, CreateContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto, CreateShopDrawingDto } from '@/types/dto/drawing/shop-drawing.dto';
import { SearchAsBuiltDrawingDto, CreateAsBuiltDrawingDto } from '@/types/dto/drawing/asbuilt-drawing.dto'; // Added
import { toast } from 'sonner';

type DrawingType = 'CONTRACT' | 'SHOP' | 'AS_BUILT'; // Added AS_BUILT
type DrawingSearchParams = SearchContractDrawingDto | SearchShopDrawingDto | SearchAsBuiltDrawingDto;
type CreateDrawingData = CreateContractDrawingDto | CreateShopDrawingDto | CreateAsBuiltDrawingDto;

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
      } else if (type === 'SHOP') {
        return shopDrawingService.getAll(params as SearchShopDrawingDto);
      } else {
        return asBuiltDrawingService.getAll(params as SearchAsBuiltDrawingDto);
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
      } else if (type === 'SHOP') {
        return shopDrawingService.getById(id);
      } else {
        return asBuiltDrawingService.getById(id);
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
      } else if (type === 'SHOP') {
        return shopDrawingService.create(data as CreateShopDrawingDto);
      } else {
        return asBuiltDrawingService.create(data as CreateAsBuiltDrawingDto);
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
