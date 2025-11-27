// File: lib/services/shop-drawing.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateShopDrawingDto, 
  CreateShopDrawingRevisionDto, 
  SearchShopDrawingDto 
} from "@/types/dto/drawing/shop-drawing.dto";

export const shopDrawingService = {
  /**
   * ดึงรายการแบบก่อสร้าง (Shop Drawings)
   */
  getAll: async (params: SearchShopDrawingDto) => {
    const response = await apiClient.get("/shop-drawings", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียดตาม ID (ควรได้ Revision History มาด้วย)
   */
  getById: async (id: string | number) => {
    const response = await apiClient.get(`/shop-drawings/${id}`);
    return response.data;
  },

  /**
   * สร้าง Shop Drawing ใหม่ (พร้อม Revision 0)
   */
  create: async (data: CreateShopDrawingDto) => {
    const response = await apiClient.post("/shop-drawings", data);
    return response.data;
  },

  /**
   * สร้าง Revision ใหม่สำหรับ Shop Drawing เดิม
   */
  createRevision: async (id: string | number, data: CreateShopDrawingRevisionDto) => {
    const response = await apiClient.post(`/shop-drawings/${id}/revisions`, data);
    return response.data;
  }
};