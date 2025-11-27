// File: lib/services/circulation.service.ts
import apiClient from "@/lib/api/client";

// Import DTO ที่สร้างไว้
import { CreateCirculationDto } from "@/types/dto/circulation/create-circulation.dto";
import { SearchCirculationDto } from "@/types/dto/circulation/search-circulation.dto";
import { UpdateCirculationRoutingDto } from "@/types/dto/circulation/update-circulation-routing.dto";

export const circulationService = {
  /**
   * ดึงรายการใบเวียนทั้งหมด (รองรับ Search & Filter)
   */
  getAll: async (params?: SearchCirculationDto) => {
    // GET /circulations
    const response = await apiClient.get("/circulations", { params });
    return response.data;
  },

  /**
   * ดึงรายละเอียดใบเวียนตาม ID
   */
  getById: async (id: string | number) => {
    // GET /circulations/:id
    const response = await apiClient.get(`/circulations/${id}`);
    return response.data;
  },

  /**
   * สร้างใบเวียนใหม่ (Create Circulation)
   */
  create: async (data: CreateCirculationDto) => {
    // POST /circulations
    const response = await apiClient.post("/circulations", data);
    return response.data;
  },

  /**
   * อัปเดตสถานะการเวียน (เช่น รับทราบ / ดำเนินการเสร็จสิ้น)
   * มักจะใช้ routingId หรือ circulationId ขึ้นอยู่กับการออกแบบ API หลังบ้าน
   */
  updateRouting: async (id: string | number, data: UpdateCirculationRoutingDto) => {
    // PATCH /circulations/:id/routing (หรือ endpoint ที่ Backend กำหนด)
    const response = await apiClient.patch(`/circulations/${id}/routing`, data);
    return response.data;
  },

  /**
   * ลบ/ยกเลิกใบเวียน
   */
  delete: async (id: string | number) => {
    const response = await apiClient.delete(`/circulations/${id}`);
    return response.data;
  }
};