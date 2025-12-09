// File: lib/services/master-data.service.ts
import apiClient from "@/lib/api/client";

// Import DTOs
import { CreateTagDto, UpdateTagDto, SearchTagDto } from "@/types/dto/master/tag.dto";
import { CreateDisciplineDto } from "@/types/dto/master/discipline.dto";
import { CreateSubTypeDto } from "@/types/dto/master/sub-type.dto";
import { SaveNumberFormatDto } from "@/types/dto/master/number-format.dto";
import { Organization } from "@/types/organization";

export const masterDataService = {
  // --- Tags Management ---

  /** ดึงรายการ Tags ทั้งหมด (Search & Pagination) */
  getTags: async (params?: SearchTagDto) => {
    const response = await apiClient.get("/tags", { params });
    // Support both wrapped and unwrapped scenarios
    return response.data.data || response.data;
  },

  /** สร้าง Tag ใหม่ */
  createTag: async (data: CreateTagDto) => {
    const response = await apiClient.post("/tags", data);
    return response.data;
  },

  /** แก้ไข Tag */
  updateTag: async (id: number | string, data: UpdateTagDto) => {
    const response = await apiClient.put(`/tags/${id}`, data);
    return response.data;
  },

  /** ลบ Tag */
  deleteTag: async (id: number | string) => {
    const response = await apiClient.delete(`/tags/${id}`);
    return response.data;
  },

  // --- Organizations (Global) ---

  /** ดึงรายชื่อองค์กรทั้งหมด */
  getOrganizations: async () => {
    const response = await apiClient.get<any>("/organizations");
    return response.data.data || response.data;
  },

  /** สร้างองค์กรใหม่ */
  createOrganization: async (data: any) => {
    const response = await apiClient.post("/organizations", data);
    return response.data;
  },

  /** แก้ไของค์กร */
  updateOrganization: async (id: number, data: any) => {
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

  // --- Document Numbering Format (Admin Config) ---

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
  }
};
