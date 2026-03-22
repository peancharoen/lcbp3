import apiClient from '@/lib/api/client';
import { CreateContractDto, UpdateContractDto, SearchContractDto } from '@/types/dto/contract/contract.dto';

export const contractService = {
  /**
   * Get all contracts (supports filtering by projectId)
   * GET /contracts?projectId=1
   */
  getAll: async (params?: SearchContractDto) => {
    const response = await apiClient.get('/contracts', { params });
    if (response.data && Array.isArray(response.data.data)) {
      return response.data.data;
    }
    return response.data.data || response.data;
  },

  /**
   * Get contract by UUID
   * GET /contracts/:uuid
   */
  getByUuid: async (uuid: string) => {
    const response = await apiClient.get(`/contracts/${uuid}`);
    return response.data;
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
