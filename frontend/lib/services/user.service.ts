import apiClient from '@/lib/api/client';
import { CreateUserDto, UpdateUserDto, SearchUserDto, User, Role } from '@/types/user';

/** Raw API user shape (before transform) */
interface RawUser {
  user_id?: number;
  userId?: number;
  assignments?: Array<{ role: unknown }>;
  [key: string]: unknown;
}

const extractArrayData = <T>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== 'object' || !('data' in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

const transformUser = (user: RawUser): User => {
  return {
    ...(user as unknown as User),
    publicId: (user.publicId as string) ?? '',
    userId: (user.user_id ?? user.userId) as number | undefined,
    roles: (user.assignments?.map((a) => a.role) ?? []) as User['roles'],
  };
};

/** Paginated or unwrapped response shape */
type UserListResponse = User[] | { data: User[] | { data: User[] } };

export const userService = {
  getAll: async (params?: SearchUserDto) => {
    const response = await apiClient.get<UserListResponse>('/users', { params });
    return extractArrayData<RawUser>(response.data).map(transformUser);
  },

  getRoles: async (): Promise<Role[]> => {
    const response = await apiClient.get<{ data: unknown } | unknown>('/users/roles');
    return extractArrayData<Role>(response.data);
  },

  getByUuid: async (uuid: string) => {
    const response = await apiClient.get<RawUser>(`/users/${uuid}`);
    return transformUser(response.data);
  },

  create: async (data: CreateUserDto) => {
    const response = await apiClient.post<RawUser>('/users', data);
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
