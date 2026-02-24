// File: lib/services/master-data.service.ts
import apiClient from "@/lib/api/client";

// Import DTOs
import { CreateTagDto, UpdateTagDto, SearchTagDto } from "@/types/dto/master/tag.dto";
import { CreateDisciplineDto } from "@/types/dto/master/discipline.dto";
import { CreateSubTypeDto } from "@/types/dto/master/sub-type.dto";
import { SaveNumberFormatDto } from "@/types/dto/master/number-format.dto";
import { CreateRfaTypeDto, UpdateRfaTypeDto } from "@/types/dto/master/rfa-type.dto";
import { CreateCorrespondenceTypeDto, UpdateCorrespondenceTypeDto } from "@/types/dto/master/correspondence-type.dto";
import { Organization } from "@/types/organization";
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  SearchOrganizationDto,
} from "@/types/dto/organization/organization.dto";

export const masterDataService = {
  // --- Tags Management ---

  /** ดึงรายการ Tags ทั้งหมด (Search & Pagination) */
  getTags: async (params?: SearchTagDto) => {
    const response = await apiClient.get("/master/tags", { params });
    // Support both wrapped and unwrapped scenarios
    return response.data.data || response.data;
  },

  /** สร้าง Tag ใหม่ */
  createTag: async (data: CreateTagDto) => {
    const response = await apiClient.post("/master/tags", data);
    return response.data;
  },

  /** แก้ไข Tag */
  updateTag: async (id: number | string, data: UpdateTagDto) => {
    const response = await apiClient.patch(`/master/tags/${id}`, data);
    return response.data;
  },

  /** ลบ Tag */
  deleteTag: async (id: number | string) => {
    const response = await apiClient.delete(`/master/tags/${id}`);
    return response.data;
  },

  // --- Organizations (Global) ---

  /** ดึงรายชื่อองค์กรทั้งหมด */
  getOrganizations: async (params?: SearchOrganizationDto) => {
    const response = await apiClient.get<Organization[] | { data: Organization[] }>("/organizations", { params });
    // Support paginated response
    if (response.data && Array.isArray((response.data as { data: Organization[] }).data)) {
        return (response.data as { data: Organization[] }).data;
    }
    // If response.data itself is an array
    if (Array.isArray(response.data)) {
        return response.data;
    }
    // If we're here, it might be { data: [], total: ... } but data is missing? or empty?
    // Or it returned the object but data.data check failed (shouldn't happen if it follows schema).
    // Let's default to [] if we can't find an array, because callers expect array.
    // However, if we return [] we lose data if it was there but not recognized.

    // Fallback: Check if response.data is object?
    // If it's the paginated object, return the data array if it exists
    if (response.data && (response.data as { data: Organization[] }).data) {
        // Maybe it's not an array?
        return Array.isArray((response.data as { data: Organization[] }).data) ? (response.data as { data: Organization[] }).data : [];
    }

    return []; // Return empty array to prevent map errors
  },

  /** สร้างองค์กรใหม่ */
  createOrganization: async (data: CreateOrganizationDto) => {
    const response = await apiClient.post("/organizations", data);
    return response.data;
  },

  /** แก้ไของค์กร */
  updateOrganization: async (id: number, data: UpdateOrganizationDto) => {
    const response = await apiClient.put(`/organizations/${id}`, data);
    return response.data;
  },

  /** ลบองค์กร */
  deleteOrganization: async (id: number) => {
    const response = await apiClient.delete(`/organizations/${id}`);
    return response.data;
  },


  // --- Disciplines Management (Admin / Req 6B) ---

  /** ดึงรายชื่อสาขางาน (มักจะกรองตาม Contract ID) */
  getDisciplines: async (contractId?: number) => {
    const response = await apiClient.get("/master/disciplines", {
      params: { contractId }
    });
    return response.data.data || response.data;
  },

  /** สร้างสาขางานใหม่ */
  createDiscipline: async (data: CreateDisciplineDto) => {
    const response = await apiClient.post("/master/disciplines", data);
    return response.data;
  },

  /** ลบสาขางาน */
  deleteDiscipline: async (id: number) => {
    const response = await apiClient.delete(`/master/disciplines/${id}`);
    return response.data;
  },

  // --- Sub-Types Management (Admin / Req 6B) ---

  /** ดึงรายชื่อประเภทย่อย (กรองตาม Contract และ Type) */
  getSubTypes: async (contractId?: number, typeId?: number) => {
    const response = await apiClient.get("/master/sub-types", {
      params: { contractId, correspondenceTypeId: typeId }
    });
    return response.data.data || response.data;
  },

  /** สร้างประเภทย่อยใหม่ */
  createSubType: async (data: CreateSubTypeDto) => {
    const response = await apiClient.post("/master/sub-types", data);
    return response.data;
  },

  // --- RFA Types Management (Admin) ---

  /** ดึงประเภท RFA ทั้งหมด */
  getRfaTypes: async (contractId?: number) => {
    const response = await apiClient.get("/master/rfa-types", {
      params: { contractId }
    });
    return response.data.data || response.data;
  },

  /** สร้างประเภท RFA ใหม่ */
  createRfaType: async (data: CreateRfaTypeDto) => {
    return apiClient.post("/master/rfa-types", data).then(res => res.data);
  },

  updateRfaType: async (id: number, data: UpdateRfaTypeDto) => {
    return apiClient.patch(`/master/rfa-types/${id}`, data).then(res => res.data);
  },

  deleteRfaType: async (id: number) => {
    return apiClient.delete(`/master/rfa-types/${id}`).then(res => res.data);
  },

  // --- Document Numbering Format (Admin Config) ---

  // --- Correspondence Types Management ---
  getCorrespondenceTypes: async () => {
    const response = await apiClient.get("/master/correspondence-types");
    return response.data.data || response.data;
  },

  createCorrespondenceType: async (data: CreateCorrespondenceTypeDto) => {
    return apiClient.post("/master/correspondence-types", data).then(res => res.data);
  },

  updateCorrespondenceType: async (id: number, data: UpdateCorrespondenceTypeDto) => {
    return apiClient.patch(`/master/correspondence-types/${id}`, data).then(res => res.data);
  },

  deleteCorrespondenceType: async (id: number) => {
    return apiClient.delete(`/master/correspondence-types/${id}`).then(res => res.data);
  },

  /** บันทึกรูปแบบเลขที่เอกสาร */
  saveNumberFormat: async (data: SaveNumberFormatDto) => {
    const response = await apiClient.post("/document-numbering/formats", data);
    return response.data;
  },

  /** ดึงรูปแบบเลขที่เอกสารปัจจุบัน (เพื่อมาแก้ไข) */
  getNumberFormat: async (projectId: number, typeId: number) => {
    const response = await apiClient.get("/document-numbering/formats", {
      params: { projectId, correspondenceTypeId: typeId }
    });
    return response.data;
  },

  // --- Drawing Categories ---

  getContractDrawingCategories: async () => {
    const response = await apiClient.get("/drawings/contract/categories");
    return response.data.data || response.data;
  },

  getShopMainCategories: async (projectId: number) => {
    const response = await apiClient.get("/drawings/shop/main-categories", { params: { projectId } });
    return response.data.data || response.data;
  },

  getShopSubCategories: async (projectId: number, mainCategoryId?: number) => {
    const response = await apiClient.get("/drawings/shop/sub-categories", {
      params: { projectId, mainCategoryId }
    });
    return response.data.data || response.data;
  }
};
