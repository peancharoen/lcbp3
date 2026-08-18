// File: frontend/components/admin/reference/color-picker-field.tsx
// Change Log:
// - 2026-08-18: Initial creation — ADR-046 ColorPickerField สำหรับเลือก tag color จาก palette

'use client';

import { useTranslations } from '@/hooks/use-translations';
import { TAG_PALETTE, type TagColorKey } from '@/lib/constants/tag-colors';
import { getTagColor } from '@/lib/utils/tag-color';
import { cn } from '@/lib/utils';

/**
 * Props สำหรับ ColorPickerField
 */
interface ColorPickerFieldProps {
  /** palette key ปัจจุบัน (อาจเป็น undefined หรือ legacy value — จะถูก normalize เป็น default) */
  value?: string | null;
  /** callback เมื่อผู้ใช้เลือก swatch — ส่ง palette key กลับไป */
  onChange: (key: TagColorKey) => void;
  /** id สำหรับ a11y (เชื่อมกับ Label) — optional */
  id?: string;
}

/**
 * ColorPickerField — inline grid 14 swatch สำหรับเลือก tag color
 *
 * - แสดง swatch 14 ตัว (TAG_PALETTE) เรียงเป็น grid
 * - swatch ที่เลือกจะมี ring-2 ring-offset-2 highlight
 * - แสดงชื่อสีที่เลือกด้านล่าง (i18n)
 * - แต่ละ swatch เป็น `<button>` สำหรับ keyboard accessibility
 * - ค่าว่าง/invalid/legacy จะถูก normalize เป็น 'default' ผ่าน getTagColor()
 *
 * ใช้ใน GenericCrudTable ผ่าน `type: 'custom'` + `render` prop
 *
 * @example
 * ```tsx
 * <ColorPickerField value={watch('colorCode')} onChange={(k) => setValue('colorCode', k)} />
 * ```
 */
export function ColorPickerField({ value, onChange, id }: ColorPickerFieldProps) {
  const t = useTranslations();
  const selectedKey: TagColorKey =
    value && TAG_PALETTE.some((e) => e.key === value)
      ? (value as TagColorKey)
      : 'default';

  return (
    <div className="space-y-2" id={id}>
      <div
        role="radiogroup"
        aria-label={t('tag.color.fieldLabel')}
        className="grid grid-cols-7 gap-2"
      >
        {TAG_PALETTE.map((entry) => {
          const isSelected = entry.key === selectedKey;
          return (
            <button
              key={entry.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={t(`tag.color.${entry.key}`)}
              title={t(`tag.color.${entry.key}`)}
              onClick={() => onChange(entry.key)}
              className={cn(
                'h-8 w-8 rounded-md border border-border transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected && 'ring-2 ring-primary ring-offset-2'
              )}
              style={{ backgroundColor: getTagColor(entry.key) }}
            />
          );
        })}
      </div>
      <p className="text-sm text-muted-foreground" data-testid="selected-color-label">
        {t('tag.color.selected', { color: t(`tag.color.${selectedKey}`) })}
      </p>
    </div>
  );
}
