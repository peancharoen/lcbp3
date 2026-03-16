export interface CreateContractDto {
  contractCode: string;
  contractName: string;
  projectId: number | string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export type UpdateContractDto = Partial<CreateContractDto>;

export interface SearchContractDto {
  search?: string;
  projectId?: number | string;
  page?: number;
  limit?: number;
}
