// File: backend/src/modules/ai/services/rag-text-segment.service.spec.ts
// Change Log:
// - 2026-09-10: T025 rename RagSegmentationService → RagTextSegmentService, T026 ย้าย chunking tests ไป rag-chunking.service.spec.ts (Feature 254)
// - 2026-09-09: เพิ่ม tests สำหรับ TextSegment normalization และ chunking (Feature 254)

import { RagTextSegment } from '../interfaces/rag-attachment.types';
import { RagTextSegmentService } from './rag-text-segment.service';

/** ส่วนขยาย service ที่รองรับ SECTION/SHEET (T055 — จะ implement ใน wave ถัดไป) */
interface RagTextSegmentServiceContract extends RagTextSegmentService {
  normalizeSection(
    sectionNumber: number,
    heading: string,
    text: string,
    sourceLocator?: string
  ): RagTextSegment;
  normalizeSheet(
    sheetNumber: number,
    text: string,
    sourceLocator?: string
  ): RagTextSegment;
}

describe('RagTextSegmentService', () => {
  const service = new RagTextSegmentService();

  it('normalizes whitespace in whole document segments', () => {
    const segment = service.normalizeWholeDocument(
      '  hello\r\n\r\n\r\nworld  '
    );
    expect(segment.segmentType).toBe('WHOLE_DOCUMENT');
    expect(segment.text).toBe('hello\n\nworld');
  });

  it('creates page segments with page number and label', () => {
    const segment = service.normalizePage(3, 'page text', 'doc.pdf#page=3');
    expect(segment.segmentType).toBe('PAGE');
    expect(segment.segmentNumber).toBe(3);
    expect(segment.segmentLabel).toBe('Page 3');
    expect(segment.sourceLocator).toBe('doc.pdf#page=3');
  });

  it('normalizes whitespace in page segments', () => {
    const segment = service.normalizePage(1, '  foo \r\n\r\n\r\n bar  ');
    expect(segment.text).toBe('foo \n\n bar');
  });

  it('handles empty text in whole document normalization', () => {
    const segment = service.normalizeWholeDocument('');
    expect(segment.segmentType).toBe('WHOLE_DOCUMENT');
    expect(segment.text).toBe('');
  });

  it('handles empty text in page normalization', () => {
    const segment = service.normalizePage(1, '');
    expect(segment.text).toBe('');
  });
});

describe('Feature 254 T055: TextSegment contract for PAGE/SECTION/SHEET/WHOLE_DOCUMENT', () => {
  // cast ผ่าน unknown เพื่อรองรับ method ที่ยังไม่ implement (RED state ตาม TDD)
  const service =
    new RagTextSegmentService() as unknown as RagTextSegmentServiceContract;

  it('normalizePage() produces a PAGE segment with page number and label', () => {
    const segment = service.normalizePage(
      5,
      'page five text',
      'doc.pdf#page=5'
    );
    expect(segment.segmentType).toBe('PAGE');
    expect(segment.segmentNumber).toBe(5);
    expect(segment.segmentLabel).toBe('Page 5');
    expect(segment.sourceLocator).toBe('doc.pdf#page=5');
    expect(segment.text).toBe('page five text');
  });

  it('normalizeSection() produces a SECTION segment with section heading', () => {
    const segment = service.normalizeSection(
      2,
      'Introduction',
      'section body text',
      'doc.pdf#section=intro'
    );
    expect(segment.segmentType).toBe('SECTION');
    expect(segment.segmentNumber).toBe(2);
    expect(segment.segmentLabel).toBe('Introduction');
    expect(segment.sourceLocator).toBe('doc.pdf#section=intro');
    expect(segment.text).toBe('section body text');
  });

  it('normalizeSheet() produces a SHEET segment with sheet number', () => {
    const segment = service.normalizeSheet(
      7,
      'sheet data',
      'workbook.xlsx#sheet=7'
    );
    expect(segment.segmentType).toBe('SHEET');
    expect(segment.segmentNumber).toBe(7);
    expect(segment.sourceLocator).toBe('workbook.xlsx#sheet=7');
    expect(segment.text).toBe('sheet data');
  });

  it('normalizeWholeDocument() produces a WHOLE_DOCUMENT segment', () => {
    const segment = service.normalizeWholeDocument('whole document text');
    expect(segment.segmentType).toBe('WHOLE_DOCUMENT');
    expect(segment.text).toBe('whole document text');
  });

  it('each segment type has the correct segmentType field value', () => {
    expect(service.normalizePage(1, 'p').segmentType).toBe('PAGE');
    expect(service.normalizeSection(1, 'S', 's').segmentType).toBe('SECTION');
    expect(service.normalizeSheet(1, 'd').segmentType).toBe('SHEET');
    expect(service.normalizeWholeDocument('w').segmentType).toBe(
      'WHOLE_DOCUMENT'
    );
  });

  it('segments preserve source text without modification (normalization only affects whitespace)', () => {
    const pageSegment = service.normalizePage(1, 'hello world');
    expect(pageSegment.text).toBe('hello world');

    const sectionSegment = service.normalizeSection(
      1,
      'Heading',
      'section content'
    );
    expect(sectionSegment.text).toBe('section content');

    const sheetSegment = service.normalizeSheet(1, 'sheet content');
    expect(sheetSegment.text).toBe('sheet content');

    const wholeSegment = service.normalizeWholeDocument('document content');
    expect(wholeSegment.text).toBe('document content');

    // whitespace normalization collapses extra spaces/newlines but preserves words
    const messy = service.normalizeWholeDocument(
      '  hello \r\n\r\n\r\n world  '
    );
    expect(messy.text).toBe('hello \n\n world');
  });
});
