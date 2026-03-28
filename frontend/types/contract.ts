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

/**
 * Safely extract publicId from a Contract object (ADR-019)
 * @param contract - Contract object or null/undefined
 * @returns publicId string or undefined
 */
export function getContractPublicId(contract: Contract | null | undefined): string | undefined {
  return contract?.publicId;
}

/**
 * Safely extract publicId from a Project reference object (ADR-019)
 * @param project - Project reference object or null/undefined
 * @returns publicId string or undefined
 */
export function getProjectPublicId(project: ContractProjectReference | null | undefined): string | undefined {
  return project?.publicId;
}
