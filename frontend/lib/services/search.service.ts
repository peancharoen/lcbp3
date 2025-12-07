// File: lib/services/search.service.ts
import apiClient from "@/lib/api/client";
import { SearchQueryDto } from "@/types/dto/search/search-query.dto";

export const searchService = {
  /**
   * ค้นหาเอกสารทั้งระบบ (Full-text Search)
   * ใช้ Elasticsearch ผ่าน Backend
   */
  search: async (query: SearchQueryDto) => {
    // ส่ง params แบบ flat ตาม DTO
    // GET /search?q=...&type=...&projectId=...
    const response = await apiClient.get("/search", {
      params: query
    });
    return response.data;
  },

  /**
   * Suggestion (Autocomplete)
   * ใช้ search endpoint แต่จำกัดจำนวน
   */
  suggest: async (query: string) => {
    const response = await apiClient.get("/search", {
      params: { q: query, limit: 5 }
    });
    // Assuming backend returns { items: [], ... } or just []
    return response.data.items || response.data;
  },

  /**
   * (Optional) Re-index ข้อมูลใหม่ กรณีข้อมูลไม่ตรง (Admin Only)
   */
  reindex: async (type?: string) => {
    const response = await apiClient.post("/search/reindex", { type });
    return response.data;
  }
};
