// File: backend/src/modules/ai/types/migration-compare-result.type.spec.ts
// Change Log:
// - 2026-08-06: Initial creation — unit test for CompareResult parser guard (T021, FR-007, FR-008)

import { parseCompareResult } from './migration-compare-result.type';

describe('parseCompareResult', () => {
  const validOutput = JSON.stringify({
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
      {
        field: 'revision',
        excelValue: 'A',
        ocrValue: null,
        match: false,
        foundInDocument: false,
      },
    ],
    mismatches: ['subject', 'revision'],
    confidence: 0.87,
  });

  it('accepts valid LLM output and returns CompareResult', () => {
    const result = parseCompareResult(validOutput);
    expect(result).not.toBeNull();
    expect(result!.fieldResults).toHaveLength(3);
    expect(result!.mismatches).toEqual(['subject', 'revision']);
    expect(result!.confidence).toBe(0.87);
  });

  it('strips ```json fence wrappers', () => {
    const fenced = '```json\n' + validOutput + '\n```';
    const result = parseCompareResult(fenced);
    expect(result).not.toBeNull();
    expect(result!.fieldResults).toHaveLength(3);
  });

  it('rejects malformed JSON', () => {
    const result = parseCompareResult('not valid json {{{');
    expect(result).toBeNull();
  });

  it('rejects empty string', () => {
    const result = parseCompareResult('');
    expect(result).toBeNull();
  });

  it('rejects non-object JSON', () => {
    const result = parseCompareResult('"a string"');
    expect(result).toBeNull();
  });

  it('rejects output with zero valid fieldResults', () => {
    const result = parseCompareResult(
      JSON.stringify({ fieldResults: [], mismatches: [], confidence: 0.5 })
    );
    expect(result).toBeNull();
  });

  it('filters out fieldResults with unknown field names', () => {
    const output = JSON.stringify({
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'X',
          ocrValue: 'X',
          match: true,
          foundInDocument: true,
        },
        {
          field: 'unknownField',
          excelValue: 'Y',
          ocrValue: 'Y',
          match: true,
          foundInDocument: true,
        },
      ],
      mismatches: [],
      confidence: 0.9,
    });
    const result = parseCompareResult(output);
    expect(result).not.toBeNull();
    expect(result!.fieldResults).toHaveLength(1);
    expect(result!.fieldResults[0].field).toBe('documentNumber');
  });

  it('forces match=false when foundInDocument=false (invariant repair)', () => {
    const output = JSON.stringify({
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'X',
          ocrValue: null,
          match: true,
          foundInDocument: false,
        },
      ],
      mismatches: [],
      confidence: 0.5,
    });
    const result = parseCompareResult(output);
    expect(result).not.toBeNull();
    expect(result!.fieldResults[0].match).toBe(false);
    expect(result!.fieldResults[0].ocrValue).toBeNull();
  });

  it('recomputes mismatches from fieldResults (does not trust model list)', () => {
    const output = JSON.stringify({
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'X',
          ocrValue: 'X',
          match: true,
          foundInDocument: true,
        },
        {
          field: 'subject',
          excelValue: 'A',
          ocrValue: 'B',
          match: false,
          foundInDocument: true,
        },
      ],
      mismatches: ['documentNumber'], // wrong — should be recomputed
      confidence: 0.8,
    });
    const result = parseCompareResult(output);
    expect(result).not.toBeNull();
    expect(result!.mismatches).toEqual(['subject']);
  });

  it('clamps confidence to [0,1]', () => {
    const output = JSON.stringify({
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'X',
          ocrValue: 'X',
          match: true,
          foundInDocument: true,
        },
      ],
      mismatches: [],
      confidence: 1.5,
    });
    const result = parseCompareResult(output);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(1);
  });

  it('defaults confidence to 0.5 when absent or non-numeric', () => {
    const output = JSON.stringify({
      fieldResults: [
        {
          field: 'documentNumber',
          excelValue: 'X',
          ocrValue: 'X',
          match: true,
          foundInDocument: true,
        },
      ],
      mismatches: [],
    });
    const result = parseCompareResult(output);
    expect(result).not.toBeNull();
    expect(result!.confidence).toBe(0.5);
  });
});
