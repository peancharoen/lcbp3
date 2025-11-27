// File: lib/services/user.service.ts
import apiClient from "@/lib/api/client";
import { 
  CreateUserDto, 
  UpdateUserDto, 
  AssignRoleDto, 
  UpdatePreferenceDto 
} from "@/types/dto/user/user.dto";

export const userService = {
  /** ดึงรายชื่อผู้ใช้ทั้งหมด (Admin) */
  getAll: async (params?: any) => {
    const response = await apiClient.get("/users", { params });
    return response.data;
  },

  /** ดึงข้อมูลผู้ใช้ตาม ID */
  getById: async (id: number | string) => {
    const response = await apiClient.get(`/users/${id}`);
    return response.data;
  },

  /** สร้างผู้ใช้ใหม่ (Admin) */
  create: async (data: CreateUserDto) => {
    const response = await apiClient.post("/users", data);
    return response.data;
  },

  /** แก้ไขข้อมูลผู้ใช้ */
  update: async (id: number | string, data: UpdateUserDto) => {
    const response = await apiClient.put(`/users/${id}`, data);
    return response.data;
  },

  /** แก้ไขการตั้งค่าส่วนตัว (Preferences) */
  updatePreferences: async (id: number | string, data: UpdatePreferenceDto) => {
    const response = await apiClient.put(`/users/${id}/preferences`, data);
    return response.data;
  },

  /** * กำหนด Role ให้ผู้ใช้ (Admin) 
   * หมายเหตุ: Backend DTO มี userId ใน body ด้วย แต่ API อาจจะรับ userId ใน param
   * ขึ้นอยู่กับการ Implement ของ Controller (ในที่นี้ส่งไปทั้งคู่เพื่อความชัวร์)
   */
  assignRole: async (userId: number | string, data: Omit<AssignRoleDto, 'userId'>) => {
    // รวม userId เข้าไปใน body เพื่อให้ตรงกับ DTO Validation ฝั่ง Backend
    const payload: AssignRoleDto = { userId: Number(userId), ...data };
    const response = await apiClient.post(`/users/${userId}/roles`, payload);
    return response.data;
  },

  /** ลบผู้ใช้ (Soft Delete) */
  delete: async (id: number | string) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  }
};