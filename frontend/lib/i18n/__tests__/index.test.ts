// File: frontend/lib/i18n/__tests__/index.test.ts
// Change Log:
// - 2026-06-14: Add coverage for Thai/English translators and template replacement

import { describe, expect, it } from 'vitest';
import { createT, t } from '../index';

describe('i18n utility', () => {
  it('default translator ควรใช้ภาษาไทย', () => {
    expect(t('workflow.action.APPROVE')).toBe('อนุมัติ');
  });

  it('createT ควรสร้าง translator ภาษาอังกฤษได้', () => {
    const translate = createT('en');
    expect(translate('workflow.action.APPROVE')).toBe('Approve');
  });

  it('ควรคืน key เดิมเมื่อไม่พบข้อความ', () => {
    const translate = createT('th');
    expect(translate('missing.translation.key')).toBe('missing.translation.key');
  });

  it('ควรแทนค่า template params ด้วย string หรือ number', () => {
    const translate = createT('en');
    expect(translate('ai.staging.thresholdWarningDesc', { rate: 42 })).toBe(
      'Override rate reached 42% in recent records.'
    );
    expect(translate('ai.prompt.resultVersionBadge', { version: '3' })).toBe('Extracted with v3');
  });

  it('ควรแทนค่า missing template param เป็นค่าว่าง', () => {
    const translate = createT('en');
    expect(translate('ai.prompt.resultVersionBadge')).toBe('Extracted with v{{version}}');
    expect(translate('ai.prompt.resultVersionBadge', {})).toBe('Extracted with v');
  });
});
