// File: lib/services/drawing-master-data.service.ts
import apiClient from '@/lib/api/client';

// ===========================
// Contract Drawing Volumes
// ===========================
export interface ContractVolume {
  id: number;
  projectId: number;
  volumeCode: string;
  volumeName: string;
  description?: string;
  sortOrder: number;
}

export interface CreateContractVolumeDto {
  projectId: number;
  volumeCode: string;
  volumeName: string;
  description?: string;
  sortOrder: number;
}

// ===========================
// Contract Drawing Categories
// ===========================
export interface ContractCategory {
  id: number;
  projectId: number;
  catCode: string;
  catName: string;
  description?: string;
  sortOrder: number;
}

export interface CreateContractCategoryDto {
  projectId: number;
  catCode: string;
  catName: string;
  description?: string;
  sortOrder: number;
}

// ===========================
// Contract Drawing Sub-categories
// ===========================
export interface ContractSubCategory {
  id: number;
  projectId: number;
  subCatCode: string;
  subCatName: string;
  description?: string;
  sortOrder: number;
}

export interface CreateContractSubCategoryDto {
  projectId: number;
  subCatCode: string;
  subCatName: string;
  description?: string;
  sortOrder: number;
}

// ===========================
// Shop Drawing Main Categories
// ===========================
export interface ShopMainCategory {
  id: number;
  projectId: number;
  mainCategoryCode: string;
  mainCategoryName: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateShopMainCategoryDto {
  projectId: number;
  mainCategoryCode: string;
  mainCategoryName: string;
  description?: string;
  isActive?: boolean;
  sortOrder: number;
}

// ===========================
// Shop Drawing Sub-categories
// ===========================
export interface ShopSubCategory {
  id: number;
  projectId: number;
  subCategoryCode: string;
  subCategoryName: string;
  description?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateShopSubCategoryDto {
  projectId: number;
  subCategoryCode: string;
  subCategoryName: string;
  description?: string;
  isActive?: boolean;
  sortOrder: number;
}

// ===========================
// Service
// ===========================
export const drawingMasterDataService = {
  // --- Contract Volumes ---
  async getContractVolumes(projectId: number): Promise<ContractVolume[]> {
    const response = await apiClient.get(`/drawings/master-data/contract/volumes`, {
      params: { projectId },
    });
    return response.data?.data || response.data;
  },

  async createContractVolume(data: CreateContractVolumeDto): Promise<ContractVolume> {
    const response = await apiClient.post(`/drawings/master-data/contract/volumes`, data);
    return response.data;
  },

  async updateContractVolume(id: number, data: Partial<CreateContractVolumeDto>): Promise<ContractVolume> {
    const response = await apiClient.patch(`/drawings/master-data/contract/volumes/${id}`, data);
    return response.data;
  },

  async deleteContractVolume(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/contract/volumes/${id}`);
  },

  // --- Contract Categories ---
  async getContractCategories(projectId: number): Promise<ContractCategory[]> {
    const response = await apiClient.get(`/drawings/master-data/contract/categories`, {
      params: { projectId },
    });
    return response.data?.data || response.data;
  },

  async createContractCategory(data: CreateContractCategoryDto): Promise<ContractCategory> {
    const response = await apiClient.post(`/drawings/master-data/contract/categories`, data);
    return response.data;
  },

  async updateContractCategory(id: number, data: Partial<CreateContractCategoryDto>): Promise<ContractCategory> {
    const response = await apiClient.patch(`/drawings/master-data/contract/categories/${id}`, data);
    return response.data;
  },

  async deleteContractCategory(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/contract/categories/${id}`);
  },

  // --- Contract Sub-categories ---
  async getContractSubCategories(projectId: number): Promise<ContractSubCategory[]> {
    const response = await apiClient.get(`/drawings/master-data/contract/sub-categories`, {
      params: { projectId },
    });
    return response.data?.data || response.data;
  },

  async createContractSubCategory(data: CreateContractSubCategoryDto): Promise<ContractSubCategory> {
    const response = await apiClient.post(`/drawings/master-data/contract/sub-categories`, data);
    return response.data;
  },

  async updateContractSubCategory(
    id: number,
    data: Partial<CreateContractSubCategoryDto>
  ): Promise<ContractSubCategory> {
    const response = await apiClient.patch(`/drawings/master-data/contract/sub-categories/${id}`, data);
    return response.data;
  },

  async deleteContractSubCategory(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/contract/sub-categories/${id}`);
  },

  // --- Contract Category Mappings ---
  async getContractMappings(
    projectId: number,
    categoryId?: number
  ): Promise<{ id: number; subCategory: ContractSubCategory; category: ContractCategory }[]> {
    const response = await apiClient.get(`/drawings/master-data/contract/mappings`, {
      params: { projectId, categoryId },
    });
    return response.data?.data || response.data;
  },

  async createContractMapping(data: {
    projectId: number;
    categoryId: number;
    subCategoryId: number;
  }): Promise<{ id: number }> {
    const response = await apiClient.post(`/drawings/master-data/contract/mappings`, data);
    return response.data;
  },

  async deleteContractMapping(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/contract/mappings/${id}`);
  },

  // --- Shop Main Categories ---
  async getShopMainCategories(projectId: number): Promise<ShopMainCategory[]> {
    const response = await apiClient.get(`/drawings/master-data/shop/main-categories`, {
      params: { projectId },
    });
    return response.data?.data || response.data;
  },

  async createShopMainCategory(data: CreateShopMainCategoryDto): Promise<ShopMainCategory> {
    const response = await apiClient.post(`/drawings/master-data/shop/main-categories`, data);
    return response.data;
  },

  async updateShopMainCategory(id: number, data: Partial<CreateShopMainCategoryDto>): Promise<ShopMainCategory> {
    const response = await apiClient.patch(`/drawings/master-data/shop/main-categories/${id}`, data);
    return response.data;
  },

  async deleteShopMainCategory(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/shop/main-categories/${id}`);
  },

  // --- Shop Sub-categories ---
  async getShopSubCategories(projectId: number, mainCategoryId?: number): Promise<ShopSubCategory[]> {
    const response = await apiClient.get(`/drawings/master-data/shop/sub-categories`, {
      params: { projectId, mainCategoryId },
    });
    return response.data?.data || response.data;
  },

  async createShopSubCategory(data: CreateShopSubCategoryDto): Promise<ShopSubCategory> {
    const response = await apiClient.post(`/drawings/master-data/shop/sub-categories`, data);
    return response.data;
  },

  async updateShopSubCategory(id: number, data: Partial<CreateShopSubCategoryDto>): Promise<ShopSubCategory> {
    const response = await apiClient.patch(`/drawings/master-data/shop/sub-categories/${id}`, data);
    return response.data;
  },

  async deleteShopSubCategory(id: number): Promise<void> {
    await apiClient.delete(`/drawings/master-data/shop/sub-categories/${id}`);
  },
};
