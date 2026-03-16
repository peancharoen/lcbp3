import apiClient from "@/lib/api/client";
import { CreateUserDto, UpdateUserDto, SearchUserDto, User } from "@/types/user";

/** Raw API user shape (before transform) */
interface RawUser {
  user_id?: number;
  userId?: number;
  assignments?: Array<{ role: unknown }>;
  [key: string]: unknown;
}

const transformUser = (user: RawUser): User => {
  return {
    ...(user as unknown as User),
    uuid: (user.uuid as string) ?? '',
    userId: (user.user_id ?? user.userId) as number | undefined,
    roles: (user.assignments?.map((a) => a.role) ?? []) as User['roles'],
  };
};

/** Paginated or unwrapped response shape */
type UserListResponse = User[] | { data: User[] | { data: User[] } };

export const userService = {
  getAll: async (params?: SearchUserDto) => {
    const response = await apiClient.get<UserListResponse>("/users", { params });

    // Handle both paginated and non-paginated responses
    let rawData: RawUser[] | unknown = response.data;
    if (rawData && !Array.isArray(rawData) && 'data' in (rawData as object)) {
      rawData = (rawData as { data: unknown }).data;
    }
    if (rawData && !Array.isArray(rawData) && typeof rawData === 'object' && 'data' in (rawData as object)) {
      rawData = (rawData as { data: unknown }).data;
    }
    if (!Array.isArray(rawData)) return [];

    return (rawData as RawUser[]).map(transformUser);
  },

  getRoles: async () => {
    const response = await apiClient.get<{ data: unknown } | unknown>("/users/roles");
    if (response.data && typeof response.data === 'object' && 'data' in (response.data as object)) {
      return (response.data as { data: unknown }).data;
    }
    return response.data;
  },

  getByUuid: async (uuid: string) => {
    const response = await apiClient.get<RawUser>(`/users/${uuid}`);
    return transformUser(response.data);
  },

  create: async (data: CreateUserDto) => {
    const response = await apiClient.post<RawUser>("/users", data);
    return transformUser(response.data);
  },

  update: async (uuid: string, data: UpdateUserDto) => {
    const response = await apiClient.put<RawUser>(`/users/${uuid}`, data);
    return transformUser(response.data);
  },

  delete: async (uuid: string) => {
    const response = await apiClient.delete(`/users/${uuid}`);
    return response.data;
  },

  // Optional: Reset Password, Deactivate etc.
};
