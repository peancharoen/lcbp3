// File: backend/tests/unit/master/tag-color-palette.spec.ts
// Change Log:
// - 2026-08-18: Initial creation — T016 DTO validation + palette consistency (ADR-046)

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TAG_COLOR_KEYS } from '../../../src/modules/master/constants/tag-colors';
import { CreateTagDto as MasterCreateTagDto } from '../../../src/modules/master/dto/create-tag.dto';
import { CreateTagDto as TagsCreateTagDto } from '../../../src/modules/tags/dto/create-tag.dto';

/**
 * ทดสอบ DTO validation ของ colorCode ในทั้งสอง path (master/tags + tags)
 * และตรวจสอบความตรงของ palette key list ระหว่าง backend mirror กับ frontend source
 *
 * อ้างอิง: ADR-046 — colorCode ต้องเป็น palette key เท่านั้น
 */
describe('Tag Color Palette — DTO validation (ADR-046)', () => {
  // ================================================================
  // 1. Master DTO (/api/master/tags) — admin CRUD path
  // ================================================================
  describe('MasterCreateTagDto', () => {
    it('ผ่านเมื่อ colorCode เป็น palette key ที่ valid ทุกตัว', async () => {
      for (const key of TAG_COLOR_KEYS) {
        const dto = plainToInstance(MasterCreateTagDto, {
          tagName: 'test-tag',
          colorCode: key,
        });
        const errors = await validate(dto);
        const colorError = errors.find((e) => e.property === 'colorCode');
        expect(colorError).toBeUndefined();
      }
    });

    it('ผ่านเมื่อ colorCode ไม่ระบุ (optional)', async () => {
      const dto = plainToInstance(MasterCreateTagDto, {
        tagName: 'test-tag',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeUndefined();
    });

    it('ปฏิเสธเมื่อ colorCode เป็น legacy hex value', async () => {
      const dto = plainToInstance(MasterCreateTagDto, {
        tagName: 'test-tag',
        colorCode: '#ff0000',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeDefined();
      expect(colorError?.constraints).toHaveProperty('isIn');
    });

    it('ปฏิเสธเมื่อ colorCode เป็นค่านอก palette', async () => {
      const dto = plainToInstance(MasterCreateTagDto, {
        tagName: 'test-tag',
        colorCode: 'purpleish',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeDefined();
      expect(colorError?.constraints).toHaveProperty('isIn');
    });

    it('ปฏิเสธเมื่อ colorCode เป็น CSS color name ที่ไม่อยู่ใน palette', async () => {
      const dto = plainToInstance(MasterCreateTagDto, {
        tagName: 'test-tag',
        colorCode: 'cyan',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeDefined();
    });
  });

  // ================================================================
  // 2. Tags DTO (/api/tags) — n8n / tag-manager path
  // ================================================================
  describe('TagsCreateTagDto', () => {
    it('ผ่านเมื่อ colorCode เป็น palette key ที่ valid ทุกตัว', async () => {
      for (const key of TAG_COLOR_KEYS) {
        const dto = plainToInstance(TagsCreateTagDto, {
          tagName: 'test-tag',
          colorCode: key,
        });
        const errors = await validate(dto);
        const colorError = errors.find((e) => e.property === 'colorCode');
        expect(colorError).toBeUndefined();
      }
    });

    it('ผ่านเมื่อ colorCode ไม่ระบุ (optional)', async () => {
      const dto = plainToInstance(TagsCreateTagDto, {
        tagName: 'test-tag',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeUndefined();
    });

    it('ปฏิเสธเมื่อ colorCode เป็น legacy hex value', async () => {
      const dto = plainToInstance(TagsCreateTagDto, {
        tagName: 'test-tag',
        colorCode: '#00ff00',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeDefined();
      expect(colorError?.constraints).toHaveProperty('isIn');
    });

    it('ปฏิเสธเมื่อ colorCode เป็นค่านอก palette', async () => {
      const dto = plainToInstance(TagsCreateTagDto, {
        tagName: 'test-tag',
        colorCode: 'not-a-color',
      });
      const errors = await validate(dto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeDefined();
    });
  });

  // ================================================================
  // 3. Palette consistency — backend mirror ตรงกับ frontend source
  // ================================================================
  describe('Palette consistency', () => {
    it('TAG_COLOR_KEYS มี 14 entries', () => {
      expect(TAG_COLOR_KEYS).toHaveLength(14);
    });

    it('TAG_COLOR_KEYS มี default เป็น entry แรก', () => {
      expect(TAG_COLOR_KEYS[0]).toBe('default');
    });

    it('TAG_COLOR_KEYS ไม่มีค่าซ้ำ', () => {
      const unique = new Set(TAG_COLOR_KEYS);
      expect(unique.size).toBe(TAG_COLOR_KEYS.length);
    });

    /**
     * Frontend source of truth: frontend/lib/constants/tag-colors.ts
     * ตรวจว่า backend mirror ตรงกับ frontend โดยอ่านไฟล์ตรงๆ
     * (cross-repo consistency check)
     */
    it('backend TAG_COLOR_KEYS ตรงกับ frontend TAG_COLOR_KEYS', () => {
      // อ่าน frontend source โดยตรงเพื่อเปรียบเทียบ
      const frontendPath = path.resolve(
        __dirname,
        '../../../../frontend/lib/constants/tag-colors.ts'
      );
      const frontendContent = fs.readFileSync(frontendPath, 'utf-8');

      // ดึงค่าจาก frontend source
      const frontendKeys: string[] = [];
      let inArray = false;
      for (const line of frontendContent.split('\n')) {
        if (line.includes('TAG_COLOR_KEYS')) inArray = true;
        if (inArray && line.trim() === '] as const;') {
          break;
        }
        if (inArray) {
          const m = line.match(/^\s*'([a-z]+)',?\s*$/);
          if (m) frontendKeys.push(m[1]);
        }
      }

      expect(frontendKeys).toEqual([...TAG_COLOR_KEYS]);
    });
  });

  // ================================================================
  // 4. Regression — post-delta update flow (US3)
  //    หลัง SQL delta แปลง legacy values → 'default'
  //    tag ที่ถูกแปลงแล้วต้อง update เป็น palette key อื่นได้ผ่าน DTO validation
  // ================================================================
  describe('Post-delta regression (US3)', () => {
    it('tag ที่ถูกแปลงเป็น "default" สามารถ update เป็น palette key อื่นได้ (master DTO)', async () => {
      // จำลอง post-delta state: tag มี colorCode = 'default' (ถูกแปลงจาก legacy hex)
      // ตรวจว่า update DTO รับ 'red' ได้ (ผ่าน validation)
      const updateDto = plainToInstance(MasterCreateTagDto, {
        tagName: 'legacy-tag',
        colorCode: 'red',
      });
      const errors = await validate(updateDto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeUndefined();
    });

    it('tag ที่ถูกแปลงเป็น "default" สามารถ update เป็น palette key อื่นได้ (tags DTO)', async () => {
      const updateDto = plainToInstance(TagsCreateTagDto, {
        tagName: 'legacy-tag',
        colorCode: 'blue',
      });
      const errors = await validate(updateDto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeUndefined();
    });

    it('tag ที่ถูกแปลงเป็น "default" สามารถคงค่า "default" ไว้ได้', async () => {
      const updateDto = plainToInstance(MasterCreateTagDto, {
        tagName: 'legacy-tag',
        colorCode: 'default',
      });
      const errors = await validate(updateDto);
      const colorError = errors.find((e) => e.property === 'colorCode');
      expect(colorError).toBeUndefined();
    });
  });
});
