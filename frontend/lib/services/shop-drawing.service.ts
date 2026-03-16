// File: lib/services/shop-drawing.service.ts
import apiClient from '@/lib/api/client';
import {
  CreateShopDrawingDto,
  CreateShopDrawingRevisionDto,
  SearchShopDrawingDto,
} from '@/types/dto/drawing/shop-drawing.dto';

export const shopDrawingService = {
  /**
   * ดึงรายการแบบก่อสร้าง (Shop Drawings)
   */
  getAll: async (params: SearchShopDrawingDto) => {
    const response = await apiClient.get('/drawings/shop', { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียดตาม ID (ควรได้ Revision History มาด้วย)
   */
  getByUuid: async (uuid: string) => {
    const response = await apiClient.get(`/drawings/shop/${uuid}`);
    return response.data;
  },

  /**
   * สร้าง Shop Drawing ใหม่ (พร้อม Revision 0)
   */
  create: async (data: CreateShopDrawingDto | FormData) => {
    const response = await apiClient.post('/drawings/shop', data);
    return response.data;
  },

  /**
   * สร้าง Revision ใหม่สำหรับ Shop Drawing เดิม
   */
  createRevision: async (uuid: string, data: CreateShopDrawingRevisionDto) => {
    const response = await apiClient.post(`/drawings/shop/${uuid}/revisions`, data);
    return response.data;
  },
};
