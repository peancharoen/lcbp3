// hooks/use-translations.ts
// ADR-021 Phase 7: React hook สำหรับ i18n — คืน t() function สำหรับใช้ใน Client Components
'use client';

import { createT } from '@/lib/i18n';

// ค่า default locale ของโปรเจกต์คือ 'th'
// เมื่อต้องการรองรับ multi-locale ให้เชื่อมกับ Context หรือ cookie ในอนาคต
const defaultT = createT('th');

export function useTranslations() {
  return defaultT;
}
