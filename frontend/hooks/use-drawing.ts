import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { asBuiltDrawingService } from '@/lib/services/asbuilt-drawing.service';
import { SearchContractDrawingDto, CreateContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto, CreateShopDrawingDto } from '@/types/dto/drawing/shop-drawing.dto';
import { SearchAsBuiltDrawingDto, CreateAsBuiltDrawingDto } from '@/types/dto/drawing/asbuilt-drawing.dto';
import { toast } from 'sonner';
import { ContractDrawing, ShopDrawing, AsBuiltDrawing } from "@/types/drawing";

type DrawingType = 'CONTRACT' | 'SHOP' | 'AS_BUILT';
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
      let response;
      if (type === 'CONTRACT') {
        response = await contractDrawingService.getAll(params as SearchContractDrawingDto);
        // Map ContractDrawing to Drawing
        if (response && response.data) {
           response.data = response.data.map((d: ContractDrawing) => ({
             ...d,
             drawingId: d.id,
             drawingNumber: d.contractDrawingNo,
             type: 'CONTRACT',
           }));
        }
      } else if (type === 'SHOP') {
        response = await shopDrawingService.getAll(params as SearchShopDrawingDto);
        // Map ShopDrawing to Drawing
        if (response && response.data) {
           response.data = response.data.map((d: ShopDrawing) => ({
             ...d,
             drawingId: d.id,
             type: 'SHOP',
             title: d.currentRevision?.title || "Untitled",
             revision: d.currentRevision?.revisionNumber,
             legacyDrawingNumber: d.currentRevision?.legacyDrawingNumber,
           }));
        }
      } else {
        response = await asBuiltDrawingService.getAll(params as SearchAsBuiltDrawingDto);
        // Map AsBuiltDrawing to Drawing
        if (response && response.data) {
            response.data = response.data.map((d: AsBuiltDrawing) => ({
              ...d,
              drawingId: d.id,
              type: 'AS_BUILT',
              title: d.currentRevision?.title || "Untitled",
              revision: d.currentRevision?.revisionNumber,
            }));
         }
      }
      return response;
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
      const typeName = type === 'CONTRACT' ? 'Contract' : type === 'SHOP' ? 'Shop' : 'As Built';
      toast.success(`${typeName} Drawing uploaded successfully`);
      queryClient.invalidateQueries({ queryKey: drawingKeys.lists() });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error('Failed to upload drawing', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}
