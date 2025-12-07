import apiClient from "@/lib/api/client";
import { CreateUserDto, UpdateUserDto, SearchUserDto, User } from "@/types/user";

export const userService = {
  getAll: async (params?: SearchUserDto) => {
    const response = await apiClient.get<User[]>("/users", { params });
    // Assuming backend returns array or paginated object.
    // If backend uses standard pagination { data: [], total: number }, adjust accordingly.
    // Based on previous code checks, it seems simple array or standard structure.
    // Let's assume standard response for now.
    return response.data;
  },

  getById: async (id: number) => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  create: async (data: CreateUserDto) => {
    const response = await apiClient.post<User>("/users", data);
    return response.data;
  },

  update: async (id: number, data: UpdateUserDto) => {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  // Optional: Reset Password, Deactivate etc.
};
