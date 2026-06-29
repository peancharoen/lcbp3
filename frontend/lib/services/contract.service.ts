import apiClient from '@/lib/api/client';
import { CreateContractDto, UpdateContractDto, SearchContractDto } from '@/types/dto/contract/contract.dto';
import { Contract } from '@/types/contract';

const normalizeContract = (record: Contract): Contract => {
  const publicId = record.publicId;
  const project = record.project
    ? {
        ...record.project,
        publicId: record.project.publicId,
      }
    : undefined;

  return {
    ...record,
    publicId,
    project,
  };
};

const extractContractArray = (payload: unknown): Contract[] => {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.map((item) => normalizeContract(item as Contract));
};

export const contractService = {
  /**
   * Get all contracts (supports filtering by projectId)
   * GET /contracts?projectId=1
   */
  getAll: async (params?: SearchContractDto) => {
    const response = await apiClient.get('/contracts', { params });
    return extractContractArray(response.data?.data ?? response.data);
  },

  /**
   * Get contract by UUID
   * GET /contracts/:uuid
   */
  getByUuid: async (uuid: string) => {
    const response = await apiClient.get(`/contracts/${uuid}`);
    const payload = response.data?.data ?? response.data;
    return normalizeContract(payload as Contract);
  },

  /**
   * Create new contract
   * POST /contracts
   */
  create: async (data: CreateContractDto) => {
    const response = await apiClient.post('/contracts', data);
    return response.data;
  },

  /**
   * Update contract
   * PATCH /contracts/:uuid
   */
  update: async (uuid: string, data: UpdateContractDto) => {
    const response = await apiClient.patch(`/contracts/${uuid}`, data);
    return response.data;
  },

  /**
   * Delete contract
   * DELETE /contracts/:uuid
   */
  delete: async (uuid: string) => {
    const response = await apiClient.delete(`/contracts/${uuid}`);
    return response.data;
  },
};
