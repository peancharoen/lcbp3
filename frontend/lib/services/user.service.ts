import apiClient from "@/lib/api/client";
import { CreateUserDto, UpdateUserDto, SearchUserDto, User } from "@/types/user";

const transformUser = (user: any): User => {
  return {
    ...user,
    userId: user.user_id,
    roles: user.assignments?.map((a: any) => a.role) || [],
  };
};

export const userService = {
  getAll: async (params?: SearchUserDto) => {
    const response = await apiClient.get<any>("/users", { params });

    // Handle both paginated and non-paginated responses
    let rawData = response.data?.data || response.data;

    // If paginated (has .data property which is array)
    if (rawData && Array.isArray(rawData.data)) {
        rawData = rawData.data;
    }

    // If still not array (e.g. error or empty), default to []
    if (!Array.isArray(rawData)) {
        return [];
    }

    return rawData.map(transformUser);
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
    return transformUser(response.data);
  },

  create: async (data: CreateUserDto) => {
    const response = await apiClient.post<User>("/users", data);
    return transformUser(response.data);
  },

  update: async (id: number, data: UpdateUserDto) => {
    const response = await apiClient.put<User>(`/users/${id}`, data);
    return transformUser(response.data);
  },

  delete: async (id: number) => {
    const response = await apiClient.delete(`/users/${id}`);
    return response.data;
  },

  // Optional: Reset Password, Deactivate etc.
};
