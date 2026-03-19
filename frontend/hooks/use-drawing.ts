import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractDrawingService } from '@/lib/services/contract-drawing.service';
import { shopDrawingService } from '@/lib/services/shop-drawing.service';
import { asBuiltDrawingService } from '@/lib/services/asbuilt-drawing.service';
import { SearchContractDrawingDto, CreateContractDrawingDto, UpdateContractDrawingDto } from '@/types/dto/drawing/contract-drawing.dto';
import { SearchShopDrawingDto, CreateShopDrawingDto, CreateShopDrawingRevisionDto } from '@/types/dto/drawing/shop-drawing.dto';
import { SearchAsBuiltDrawingDto, CreateAsBuiltDrawingDto, CreateAsBuiltDrawingRevisionDto } from '@/types/dto/drawing/asbuilt-drawing.dto';
import { toast } from 'sonner';
import { ContractDrawing, ShopDrawing, AsBuiltDrawing } from '@/types/drawing';

type DrawingType = 'CONTRACT' | 'SHOP' | 'AS_BUILT';
type DrawingSearchParams = SearchContractDrawingDto | SearchShopDrawingDto | SearchAsBuiltDrawingDto;
type CreateDrawingData = CreateContractDrawingDto | CreateShopDrawingDto | CreateAsBuiltDrawingDto;

export const drawingKeys = {
  all: ['drawings'] as const,
  lists: () => [...drawingKeys.all, 'list'] as const,
  list: (type: DrawingType, params: DrawingSearchParams) => [...drawingKeys.lists(), type, params] as const,
  details: () => [...drawingKeys.all, 'detail'] as const,
  detail: (type: DrawingType, uuid: string) => [...drawingKeys.details(), type, uuid] as const,
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
          const mappedData = response.data.map((d: ContractDrawing) => ({
            ...d,
            uuid: d.uuid || (d as unknown as { id: string }).id,
            drawingNumber: d.contractDrawingNo,
            type: 'CONTRACT',
          }));
          // Re-wrap to preserve meta
          response = { ...response, data: mappedData };
        }
      } else if (type === 'SHOP') {
        response = await shopDrawingService.getAll(params as SearchShopDrawingDto);
        // Map ShopDrawing to Drawing
        if (response && response.data) {
          const mappedData = response.data.map((d: ShopDrawing) => ({
            ...d,
            uuid: d.uuid || (d as unknown as { id: string }).id,
            type: 'SHOP',
            title: d.currentRevision?.title || 'Untitled',
            revision: d.currentRevision?.revisionNumber,
            legacyDrawingNumber: d.currentRevision?.legacyDrawingNumber,
          }));
          // Re-wrap to preserve meta
          response = { ...response, data: mappedData };
        }
      } else {
        response = await asBuiltDrawingService.getAll(params as SearchAsBuiltDrawingDto);
        // Map AsBuiltDrawing to Drawing
        if (response && response.data) {
          const mappedData = response.data.map((d: AsBuiltDrawing) => ({
            ...d,
            uuid: d.uuid || (d as unknown as { id: string }).id,
            type: 'AS_BUILT',
            title: d.currentRevision?.title || 'Untitled',
            revision: d.currentRevision?.revisionNumber,
          }));
          // Re-wrap to preserve meta
          response = { ...response, data: mappedData };
        }
      }
      return response;
    },
    placeholderData: (previousData) => previousData,
  });
}

export function useDrawing(type: DrawingType, uuid: string) {
  return useQuery({
    queryKey: drawingKeys.detail(type, uuid),
    queryFn: async () => {
      if (type === 'CONTRACT') {
        return contractDrawingService.getByUuid(uuid);
      } else if (type === 'SHOP') {
        return shopDrawingService.getByUuid(uuid);
      } else {
        return asBuiltDrawingService.getByUuid(uuid);
      }
    },
    enabled: !!uuid,
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

export function useUpdateContractDrawing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uuid, data }: { uuid: string; data: UpdateContractDrawingDto }) => {
      return contractDrawingService.update(uuid, data);
    },
    onSuccess: () => {
      toast.success('Drawing updated successfully');
      queryClient.invalidateQueries({ queryKey: drawingKeys.all });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error('Failed to update drawing', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}

export function useUploadRevision(type: DrawingType) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ uuid, data }: { uuid: string; data: CreateShopDrawingRevisionDto | CreateAsBuiltDrawingRevisionDto }) => {
      if (type === 'SHOP') {
        return shopDrawingService.createRevision(uuid, data as CreateShopDrawingRevisionDto);
      } else {
        return asBuiltDrawingService.createRevision(uuid, data as CreateAsBuiltDrawingRevisionDto);
      }
    },
    onSuccess: () => {
      toast.success('Revision uploaded successfully');
      queryClient.invalidateQueries({ queryKey: drawingKeys.all });
    },
    onError: (error: Error & { response?: { data?: { message?: string } } }) => {
      toast.error('Failed to upload revision', {
        description: error.response?.data?.message || 'Something went wrong',
      });
    },
  });
}
