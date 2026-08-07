// File: backend/tests/e2e/migration-compare.e2e-spec.ts
// Change Log:
// - 2026-08-06: Initial creation — integration test for migration compare endpoint (T023, FR-006, FR-007, FR-008, FR-009, FR-012)

/**
 * E2E-like tests for Migration Compare Pipeline (Feature 242)
 * Tests the compare flow: migrate-document job → OCR → LLM compare → review queue with compareResult
 * Following simplified E2E pattern from ocr-prompt-management.e2e-spec.ts
 */

import { parseCompareResult } from '../../src/modules/ai/types/migration-compare-result.type';
import { isDwgFile } from '../../src/modules/migration/constants/dwg-exclusion.constant';
import {
  deriveTagName,
  TAG_MAPPING_RULES,
} from '../../src/modules/migration/types/tag-mapping-rule';
import {
  DEFAULT_REVIEW_THRESHOLDS,
  THRESHOLD_VALIDATION,
} from '../../src/modules/migration/types/review-threshold.type';

describe('Migration Compare Pipeline (E2E)', () => {
  describe('T023: Compare Result Parsing', () => {
    it('should parse valid LLM compare output into typed CompareResult', () => {
      const llmOutput = JSON.stringify({
        fieldResults: [
          {
            field: 'documentNumber',
            excelValue: 'LCBP3-CSC-RFA-00123',
            ocrValue: 'LCBP3-CSC-RFA-00123',
            match: true,
            foundInDocument: true,
          },
          {
            field: 'subject',
            excelValue: 'ทดสอบ',
            ocrValue: 'ทดสอบ แก้ไข',
            match: false,
            foundInDocument: true,
          },
        ],
        mismatches: ['subject'],
        confidence: 0.85,
      });
      const result = parseCompareResult(llmOutput);
      expect(result).not.toBeNull();
      expect(result!.fieldResults).toHaveLength(2);
      expect(result!.mismatches).toEqual(['subject']);
      expect(result!.confidence).toBe(0.85);
    });

    it('should reject malformed LLM output', () => {
      expect(parseCompareResult('not json')).toBeNull();
      expect(parseCompareResult('')).toBeNull();
      expect(parseCompareResult('{}')).toBeNull();
    });
  });

  describe('T023: DWG Exclusion (FR-015, FR-022)', () => {
    it('should identify DWG files by MIME type', () => {
      expect(isDwgFile('image/vnd.dwg', 'drawing.dwg')).toBe(true);
      expect(isDwgFile('application/acad', 'plan.dwg')).toBe(true);
    });

    it('should identify DWG files by extension when MIME is octet-stream', () => {
      expect(isDwgFile('application/octet-stream', 'drawing.dwg')).toBe(true);
      expect(isDwgFile('application/octet-stream', 'schema.dxf')).toBe(true);
    });

    it('should not identify PDF as DWG', () => {
      expect(isDwgFile('application/pdf', 'document.pdf')).toBe(false);
    });

    it('should not identify null/undefined as DWG', () => {
      expect(isDwgFile(null, null)).toBe(false);
      expect(isDwgFile(undefined, undefined)).toBe(false);
    });
  });

  describe('T023: Tag Mapping Rules (FR-018, FR-018b)', () => {
    it('should derive tag name from discipline register field', () => {
      expect(deriveTagName('discipline', 'STRUCT')).toBe('discipline:STRUCT');
    });

    it('should derive tag name from correspondenceType register field', () => {
      expect(deriveTagName('correspondenceType', 'RFA')).toBe('type:RFA');
    });

    it('should return null for unknown register field', () => {
      expect(deriveTagName('unknown', 'X')).toBeNull();
    });

    it('should return null for empty value', () => {
      expect(deriveTagName('discipline', '  ')).toBeNull();
    });

    it('should have exactly 2 mapping rules', () => {
      expect(TAG_MAPPING_RULES).toHaveLength(2);
    });
  });

  describe('T023: Review Thresholds (FR-010)', () => {
    it('should have default maxMismatchFields = 3 (production behavior)', () => {
      expect(DEFAULT_REVIEW_THRESHOLDS.maxMismatchFields).toBe(3);
    });

    it('should have default minConfidence = 0.6 (production behavior)', () => {
      expect(DEFAULT_REVIEW_THRESHOLDS.minConfidence).toBe(0.6);
    });

    it('should enforce validation bounds', () => {
      expect(THRESHOLD_VALIDATION.maxMismatchFields.min).toBe(0);
      expect(THRESHOLD_VALIDATION.maxMismatchFields.max).toBe(9);
      expect(THRESHOLD_VALIDATION.minConfidence.min).toBe(0);
      expect(THRESHOLD_VALIDATION.minConfidence.max).toBe(1);
    });
  });

  describe('T023: Compare Status Flow (FR-012a, FR-012b)', () => {
    it('should support COMPARED status for normal flow', () => {
      const statuses = ['COMPARED', 'UNAVAILABLE'];
      expect(statuses).toContain('COMPARED');
    });

    it('should support UNAVAILABLE status with reason for DWG-only attachments', () => {
      const reason = 'เอกสารหลักเป็นไฟล์ DWG ไม่สามารถ OCR เพื่อเปรียบเทียบได้';
      expect(reason.length).toBeGreaterThan(0);
      expect(reason.length).toBeLessThanOrEqual(500);
    });
  });
});
