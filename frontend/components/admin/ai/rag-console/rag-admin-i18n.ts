// File: frontend/components/admin/ai/rag-console/rag-admin-i18n.ts
// Change Log:
// - 2026-09-10: สร้าง i18n helper สำหรับ rag.admin namespace จาก ai.json (Feature 255)
// - 2026-09-11: Refactor เป็น hook useRagAdminT() ที่รองรับทั้ง en/th locale (ADR i18n)

'use client';

import { useMemo } from 'react';
import enMessages from '@/public/locales/en/ai.json';
import thMessages from '@/public/locales/th/ai.json';

type Locale = 'th' | 'en';

const messagesByLocale: Record<Locale, Record<string, unknown>> = {
  th: thMessages as unknown as Record<string, unknown>,
  en: enMessages as unknown as Record<string, unknown>,
};

/**
 * Resolve a dotted key path against a nested object.
 * Returns the found string, or the key itself if not found.
 */
function resolveKey(
  root: Record<string, unknown>,
  key: string
): string {
  const ragRoot = (root as Record<string, unknown>).rag as
    | Record<string, unknown>
    | undefined;
  const adminRoot = ragRoot?.admin as Record<string, unknown> | undefined;
  if (!adminRoot) return key;

  const parts = key.split('.');
  let current: unknown = adminRoot;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : key;
}

/**
 * Interpolate {{param}} placeholders in a template string.
 */
function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    String(params[k] ?? '')
  );
}

/**
 * Hook สำหรับ rag.admin namespace i18n — รองรับทั้ง en/th locale
 * ใช้ใน RAG Admin Console components (Feature 255)
 *
 * @example
 * const ragAdminT = useRagAdminT();
 * ragAdminT('tabs.dashboard');
 * ragAdminT('retry.partial_success', { succeeded: 3, failed: 1 });
 */
export function useRagAdminT(locale: Locale = 'th') {
  return useMemo(() => {
    const messages = messagesByLocale[locale];
    return (key: string, params?: Record<string, string | number>): string => {
      const text = resolveKey(messages, key);
      return interpolate(text, params);
    };
  }, [locale]);
}

/**
 * Plain function variant สำหรับใช้ใน non-component contexts (e.g. module-level constants)
 * Defaults to Thai (project default locale)
 */
export function ragAdminT(
  key: string,
  params?: Record<string, string | number>
): string {
  const text = resolveKey(messagesByLocale.th, key);
  return interpolate(text, params);
}
