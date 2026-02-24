export interface CreateContractDto {
  contractCode: string;
  contractName: string;
  projectId: number;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export type UpdateContractDto = Partial<CreateContractDto>;

export interface SearchContractDto {
  search?: string;
  projectId?: number;
  page?: number;
  limit?: number;
}
