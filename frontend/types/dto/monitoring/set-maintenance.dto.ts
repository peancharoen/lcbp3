// File: src/types/dto/monitoring/set-maintenance.dto.ts

export interface SetMaintenanceDto {
  /** สถานะ Maintenance (true = เปิด, false = ปิด) */
  enabled: boolean;

  /** เหตุผลที่ปิดปรับปรุง (แสดงให้ User เห็น) */
  reason?: string;
}