// File: frontend/lib/services/organization-links.service.ts
// Change Log:
// - 2026-10-08: Service กลางสำหรับจัดการ Project↔Org / Contract↔Org links พร้อม role
//   (deferred จาก PR #29 — role ของ org มีความหมายเฉพาะใน context นั้น ๆ)
import apiClient from '@/lib/api/client';
import { LinkedOrganization } from '@/types/organization';

/** context ที่องค์กรถูกผูก — ตรงกับ junction table ฝั่ง backend */
export type LinkContext = 'project' | 'contract';

const basePath = (context: LinkContext, contextUuid: string) =>
  context === 'project'
    ? `/projects/${contextUuid}`
    : `/contracts/${contextUuid}`;

export const organizationLinksService = {
  /** ดึงองค์กรที่ผูกกับ context พร้อม role */
  list: async (
    context: LinkContext,
    contextUuid: string
  ): Promise<LinkedOrganization[]> => {
    const response = await apiClient.get(
      `${basePath(context, contextUuid)}/organizations`
    );
    return response.data?.data ?? response.data;
  },

  /** ผูกองค์กรเข้า context พร้อม role */
  link: async (
    context: LinkContext,
    contextUuid: string,
    payload: { organizationId: string; roleName: string }
  ): Promise<LinkedOrganization> => {
    const response = await apiClient.post(
      `${basePath(context, contextUuid)}/organizations`,
      payload
    );
    return response.data?.data ?? response.data;
  },

  /** เปลี่ยน role ขององค์กรที่ผูกอยู่ */
  updateRole: async (
    context: LinkContext,
    contextUuid: string,
    organizationId: string,
    roleName: string
  ): Promise<LinkedOrganization> => {
    const response = await apiClient.patch(
      `${basePath(context, contextUuid)}/organizations/${organizationId}`,
      { roleName }
    );
    return response.data?.data ?? response.data;
  },

  /** ถอดองค์กรออกจาก context */
  unlink: async (
    context: LinkContext,
    contextUuid: string,
    organizationId: string
  ): Promise<void> => {
    await apiClient.delete(
      `${basePath(context, contextUuid)}/organizations/${organizationId}`
    );
  },
};
