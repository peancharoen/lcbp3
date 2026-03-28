export interface ContractProjectReference {
  publicId?: string;
  projectCode: string;
  projectName: string;
}

export interface Contract {
  publicId?: string;
  contractCode: string;
  contractName: string;
  projectId?: number | string;
  description?: string;
  startDate?: string;
  endDate?: string;
  project?: ContractProjectReference;
}
