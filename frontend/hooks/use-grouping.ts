// File: frontend/hooks/use-grouping.ts
// Change Log:
// - 2026-10-06: Initial creation — TanStack Query hooks สำหรับ user_groups/departments (User Grouping Model)

import { useQuery } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';

/** Option ของ user group จาก GET /user-groups */
export interface UserGroupOption {
  publicId: string;
  name: string;
}

/** Option ของ department จาก GET /organizations/:uuid/departments */
export interface DepartmentOption {
  publicId: string;
  departmentName: string;
}

/** รายการ user groups ทั้งหมด (filter ตาม org ได้ผ่าน orgPublicId) */
export function useUserGroups(orgPublicId?: string) {
  return useQuery<UserGroupOption[]>({
    queryKey: ['user-groups', orgPublicId ?? 'all'],
    queryFn: async () => {
      const response = await apiClient.get('/user-groups', {
        params: orgPublicId ? { organization: orgPublicId } : undefined,
      });
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as UserGroupOption[]) : [];
    },
  });
}

/** รายการ departments ของ org ที่เลือก (disabled จนกว่าจะเลือก org) */
export function useDepartments(orgPublicId?: string) {
  return useQuery<DepartmentOption[]>({
    queryKey: ['departments', orgPublicId],
    enabled: Boolean(orgPublicId),
    queryFn: async () => {
      const response = await apiClient.get(
        `/organizations/${orgPublicId}/departments`
      );
      const data = response.data?.data ?? response.data;
      return Array.isArray(data) ? (data as DepartmentOption[]) : [];
    },
  });
}
