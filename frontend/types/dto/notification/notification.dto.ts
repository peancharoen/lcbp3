// File: src/types/dto/notification/notification.dto.ts

export type NotificationType = 'EMAIL' | 'LINE' | 'SYSTEM';

// --- Create ---
export interface CreateNotificationDto {
  /** ผู้รับ (User ID) */
  userId: number;

  /** หัวข้อแจ้งเตือน */
  title: string;

  /** ข้อความรายละเอียด */
  message: string;

  /** ประเภท: EMAIL, LINE, SYSTEM */
  type: NotificationType;

  /** Entity ที่เกี่ยวข้อง เช่น 'rfa', 'correspondence' */
  entityType?: string;

  /** ID ของ Entity */
  entityId?: number;

  /** Link ไปยังหน้าเว็บ (Frontend) */
  link?: string;
}

// --- Search ---
export interface SearchNotificationDto {
  /** หน้าปัจจุบัน (Default: 1) */
  page?: number;

  /** จำนวนต่อหน้า (Default: 20) */
  limit?: number;

  /** กรอง: อ่านแล้ว (true) / ยังไม่อ่าน (false) */
  isRead?: boolean;
}