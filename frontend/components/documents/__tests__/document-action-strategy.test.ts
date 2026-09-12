// File: frontend/components/documents/__tests__/document-action-strategy.test.ts
// Change Log:
// - 2026-09-12: Unit tests สำหรับ document-action-strategy (Feature 253 — Phase 2 Frontend Unit)

import { describe, it, expect } from 'vitest';
import { getDocumentActionConfig, type DocumentActionConfig } from '../document-action-strategy';

describe('document-action-strategy (Feature 253 — Phase 2 Frontend Unit)', () => {
  describe('getDocumentActionConfig', () => {
    it('คืนค่า config สำหรับ CORRESPONDENCE', () => {
      const config = getDocumentActionConfig('CORRESPONDENCE');
      expect(config.displayName).toBe('document.type.correspondence');
      expect(config.apiBasePath).toBe('/api/v1/correspondences');
      expect(config.requiredPermission).toBe('correspondence.cancel');
    });

    it('คืนค่า config สำหรับ RFA', () => {
      const config = getDocumentActionConfig('RFA');
      expect(config.apiBasePath).toBe('/api/v1/rfas');
      expect(config.requiredPermission).toBe('rfa.cancel');
    });

    it('คืนค่า config สำหรับ TRANSMITTAL', () => {
      const config = getDocumentActionConfig('TRANSMITTAL');
      expect(config.apiBasePath).toBe('/api/v1/transmittals');
    });

    it('คืนค่า config สำหรับ DRAWING', () => {
      const config = getDocumentActionConfig('DRAWING');
      expect(config.apiBasePath).toBe('/api/v1/drawings/contract');
    });

    it('คืนค่า config สำหรับ CIRCULATION', () => {
      const config = getDocumentActionConfig('CIRCULATION');
      expect(config.apiBasePath).toBe('/api/v1/circulations');
      expect(config.requiredPermission).toBe('circulation.close');
    });

    it('throw Error สำหรับ unknown document type', () => {
      expect(() => getDocumentActionConfig('UNKNOWN')).toThrow(
        'Unknown document type: UNKNOWN',
      );
    });

    it('ทุก config มี patchableFields ครบ 3 tier (ADR-019 + 3-tier metadata)', () => {
      const types = ['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING', 'CIRCULATION'];
      for (const type of types) {
        const config: DocumentActionConfig = getDocumentActionConfig(type);
        expect(config.patchableFields).toBeDefined();
        expect(Array.isArray(config.patchableFields.tier1)).toBe(true);
        expect(Array.isArray(config.patchableFields.tier2)).toBe(true);
        expect(Array.isArray(config.patchableFields.tier3)).toBe(true);
      }
    });

    it('ADR-019: ทุก config ไม่มี INT id field — ใช้ publicId-based API path', () => {
      const types = ['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING', 'CIRCULATION'];
      for (const type of types) {
        const config = getDocumentActionConfig(type);
        // apiBasePath ต้องไม่มี /:id หรือ /{id} (INT pattern)
        expect(config.apiBasePath).not.toMatch(/\/:\d+/);
        expect(config.apiBasePath).not.toMatch(/\/\{id\}/);
      }
    });

    it('ทุก config มี i18n keys (confirmKey, successKey, failedKey)', () => {
      const types = ['CORRESPONDENCE', 'RFA', 'TRANSMITTAL', 'DRAWING', 'CIRCULATION'];
      for (const type of types) {
        const config = getDocumentActionConfig(type);
        expect(typeof config.confirmKey).toBe('string');
        expect(typeof config.successKey).toBe('string');
        expect(typeof config.failedKey).toBe('string');
        expect(config.confirmKey.length).toBeGreaterThan(0);
      }
    });
  });
});
