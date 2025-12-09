import apiClient from "@/lib/api/client";
import { CreateUserDto, UpdateUserDto, SearchUserDto, User } from "@/types/user";

export const userService = {
  getAll: async (params?: SearchUserDto) => {
    const response = await apiClient.get<any>("/users", { params });
    // Unwrap NestJS TransformInterceptor response
    if (response.data?.data) {
      return response.data.data as User[];
    }
    return response.data as User[];
  },

  getRoles: async () => {
    const response = await apiClient.get<any>("/users/roles");
    if (response.data?.data) {
      return response.data.data;
    }
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
