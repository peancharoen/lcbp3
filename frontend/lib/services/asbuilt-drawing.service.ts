// File: lib/services/asbuilt-drawing.service.ts
import apiClient from "@/lib/api/client";
import {
  CreateAsBuiltDrawingDto,
  CreateAsBuiltDrawingRevisionDto,
  SearchAsBuiltDrawingDto
} from "@/types/dto/drawing/asbuilt-drawing.dto";

export const asBuiltDrawingService = {
  /**
   * Get As Built Drawings list
   */
  getAll: async (params: SearchAsBuiltDrawingDto) => {
    const response = await apiClient.get("/drawings/asbuilt", { params });
    return response.data;
  },

  /**
   * Get details by ID
   */
  getById: async (id: string | number) => {
    const response = await apiClient.get(`/drawings/asbuilt/${id}`);
    return response.data;
  },

  /**
   * Create New As Built Drawing
   */
  create: async (data: CreateAsBuiltDrawingDto | FormData) => {
    const response = await apiClient.post("/drawings/asbuilt", data);
    return response.data;
  },

  /**
   * Create New Revision
   */
  createRevision: async (id: string | number, data: CreateAsBuiltDrawingRevisionDto) => {
    const response = await apiClient.post(`/drawings/asbuilt/${id}/revisions`, data);
    return response.data;
  }
};
