import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMetadata {
  action: string; // ชื่อการกระทำ (เช่น 'rfa.create', 'user.login')
  entityType?: string; // ชื่อ Entity (เช่น 'rfa', 'user') - ถ้าไม่ระบุอาจจะพยายามเดา
}

export const Audit = (action: string, entityType?: string) =>
  SetMetadata(AUDIT_KEY, { action, entityType });
