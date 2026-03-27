export interface ContractProjectReference {
  publicId?: string;
  id?: string;
  projectCode: string;
  projectName: string;
}

export interface Contract {
  publicId?: string;
  id?: string;
  contractCode: string;
  contractName: string;
  projectId?: number | string;
  description?: string;
  startDate?: string;
  endDate?: string;
  project?: ContractProjectReference;
}

export const getContractPublicId = (contract?: Pick<Contract, 'publicId' | 'id'>): string =>
  String(contract?.publicId ?? contract?.id ?? '');

export const getProjectPublicId = (
  project?: Pick<ContractProjectReference, 'publicId' | 'id'>
): string => String(project?.publicId ?? project?.id ?? '');
