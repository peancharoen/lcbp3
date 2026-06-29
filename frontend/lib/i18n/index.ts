// lib/i18n/index.ts
// ADR-021 Phase 7: Minimal i18n utility — Thai เป็น default locale
// English ถูก reserve ไว้สำหรับอนาคต (05-08-i18n-guidelines.md)

import thMessages from '@/public/locales/th/common.json';
import enMessages from '@/public/locales/en/common.json';

type Locale = 'th' | 'en';

const messages: Record<Locale, Record<string, string>> = {
  th: thMessages as Record<string, string>,
  en: enMessages as Record<string, string>,
};

// สร้าง translator function ตาม locale
export function createT(locale: Locale = 'th') {
  const dict = messages[locale];
  return function t(key: string, params?: Record<string, string | number>): string {
    const text = dict[key] ?? key;
    if (!params) return text;
    // รองรับ template เช่น "ลบ {{filename}}" → "ลบ report.pdf"
    return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(params[k] ?? ''));
  };
}

// Default translator (Thai) — ใช้ได้โดยตรงใน utility functions นอก component
export const t = createT('th');
