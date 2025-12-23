import apiClient from "@/lib/api/client";
import {
  NumberingMetrics,
  ManualOverrideDto,
  VoidReplaceDto,
  CancelNumberDto,
  AuditQueryParams
} from "@/types/dto/numbering.dto";

export const documentNumberingService = {
  // --- Admin Dashboard Metrics ---
  getMetrics: async (): Promise<NumberingMetrics> => {
    const response = await apiClient.get("/admin/document-numbering/metrics");
    return response.data;
  },

  // --- Admin Tools ---
  manualOverride: async (dto: ManualOverrideDto): Promise<void> => {
    await apiClient.post("/admin/document-numbering/manual-override", dto);
  },

  voidAndReplace: async (dto: VoidReplaceDto): Promise<any> => {
    const response = await apiClient.post("/admin/document-numbering/void-and-replace", dto);
    return response.data;
  },

  cancelNumber: async (dto: CancelNumberDto): Promise<void> => {
    await apiClient.post("/admin/document-numbering/cancel", dto);
  },

  bulkImport: async (data: FormData | any[]): Promise<any> => {
    const isFormData = data instanceof FormData;
    const config = isFormData ? { headers: { "Content-Type": "multipart/form-data" } } : {};
    const response = await apiClient.post("/admin/document-numbering/bulk-import", data, config);
    return response.data;
  },

  // --- Audit Logs ---
  getAuditLogs: async (params?: AuditQueryParams) => {
      // NOTE: endpoint might be merged with metrics or separate
      // Currently controller has getMetrics returning audit logs too.
      // But if we want separate pagination later:
      // return apiClient.get("/admin/document-numbering/audit", { params });
      return [];
  }
};
