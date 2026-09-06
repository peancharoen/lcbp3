// File: backend/src/modules/migration/services/excel-annotator.service.ts
// Change Log:
// - 2026-09-06: Initial creation - Excel Annotator Service (T013, FR-010, D4)
//   Creates annotated .xlsx with 2 Sheets (Review_Summary + Data)
//   Cell Color Coding: light red (#FCE4D6) = BLOCK, light yellow (#FFF2CC) = WARN/AI_SUGGEST
//   Cell Comments/Notes embedded on target cells
//   Audit Columns: [AI] Suggested Subject, [AI] Suggested Type, [AI] Review Notes
//   Uses ExcelJS (same as RowBuilder) - no new dependency

import { Injectable, Logger } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ExcelCorrespondenceRow,
  ReviewFinding,
  ReviewSummaryCounts,
  ANNOTATED_AUDIT_COLUMN_PREFIX,
} from '../types/excel-review.types';

/** Color for Cell Color Coding (D4) */
const COLOR_BLOCK = 'FFFCE4D6'; // light red - BLOCK
const COLOR_WARN = 'FFFFF2CC'; // light yellow - WARN / AI_SUGGEST

/** Summary sheet name (D4) */
const SUMMARY_SHEET_NAME = 'Review_Summary';

/** Data sheet name (D4) */
const DATA_SHEET_NAME = 'Data';

/** Audit column names added at the right (D4, FR-010) */
const AUDIT_COLUMNS = [
  `${ANNOTATED_AUDIT_COLUMN_PREFIX} Suggested Subject`,
  `${ANNOTATED_AUDIT_COLUMN_PREFIX} Suggested Type`,
  `${ANNOTATED_AUDIT_COLUMN_PREFIX} Review Notes`,
] as const;

/** Main data columns (in order) */
const DATA_COLUMNS = [
  'document number',
  'subject',
  'revision',
  'issued date',
  'received date',
  'from',
  'to',
  'type',
  'discipline',
  'file name',
  'remarks',
] as const;

/**
 * Input for Annotator
 * - originalFilePath: path of raw file in stash
 * - rows: data rows with findings (from Layer 1-3)
 * - counts: summary counts for Review_Summary sheet
 * - findings: all findings (for Key Findings table)
 */
export interface AnnotatorInput {
  originalFilePath: string;
  rows: ExcelCorrespondenceRow[];
  counts: ReviewSummaryCounts;
  findings: ReviewFinding[];
  /** Path to write annotated file (in stash directory) */
  outputPath: string;
}

/**
 * ExcelAnnotatorService - Creates annotated .xlsx file (T013, FR-010, D4)
 *
 * File structure (D4):
 * 1. Sheet Review_Summary: dashboard summary + Key Findings table
 * 2. Sheet Data: original data + Cell Color Coding + Cell Comments + Audit Columns
 *
 * Not a source of truth - only suggestions for human review.
 * User can edit this file and re-upload (FR-011 - [AI] columns are ignored).
 */
@Injectable()
export class ExcelAnnotatorService {
  private readonly logger = new Logger(ExcelAnnotatorService.name);

  /**
   * Generate annotated .xlsx from review data.
   * Returns absolute path of generated file.
   */
  async generateAnnotated(input: AnnotatorInput): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LCBP3-DMS Excel Import Review';
    workbook.created = new Date();

    // Sheet 1: Review_Summary
    this.buildSummarySheet(workbook, input.counts, input.findings);

    // Sheet 2: Data (with color + comments + audit columns)
    this.buildDataSheet(workbook, input.rows, input.findings);

    // Ensure output directory exists
    const outputDir = path.dirname(input.outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write file
    await workbook.xlsx.writeFile(input.outputPath);

    this.logger.log(
      `Created annotated file: ${input.outputPath} (rows=${input.rows.length})`
    );

    return input.outputPath;
  }

  // ---------- Sheet builders ----------

  /**
   * Sheet 1: Review_Summary - Dashboard summary + Key Findings (D4)
   */
  private buildSummarySheet(
    workbook: ExcelJS.Workbook,
    counts: ReviewSummaryCounts,
    findings: ReviewFinding[]
  ): void {
    const sheet = workbook.addWorksheet(SUMMARY_SHEET_NAME);

    // Section 1: summary counts
    sheet.getCell('A1').value = 'Review Summary';
    sheet.getCell('A1').font = { bold: true, size: 14 };

    sheet.getCell('A3').value = 'Total Rows';
    sheet.getCell('B3').value = counts.totalRows;
    sheet.getCell('A4').value = 'Pass';
    sheet.getCell('B4').value = counts.passCount;
    sheet.getCell('A5').value = 'Warn';
    sheet.getCell('B5').value = counts.warnCount;
    sheet.getCell('A6').value = 'Block';
    sheet.getCell('B6').value = counts.blockCount;
    sheet.getCell('A7').value = 'AI Suggestions';
    sheet.getCell('B7').value = counts.aiSuggestCount;
    sheet.getCell('A8').value = 'Can Confirm';
    sheet.getCell('B8').value = counts.canConfirm ? 'Yes' : 'No';
    sheet.getCell('B8').font = {
      bold: true,
      color: { argb: counts.canConfirm ? 'FF006100' : 'FFA10000' },
    };

    // Section 2: Key Findings (sorted by severity: BLOCK > WARN > AI_SUGGEST)
    sheet.getCell('A10').value = 'Key Findings';
    sheet.getCell('A10').font = { bold: true, size: 12 };

    const headers = ['Row', 'Column', 'Level', 'Message', 'Suggested Value'];
    const headerRow = sheet.getRow(11);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      };
    });

    const sortedFindings = [...findings].sort((a, b) => {
      const order = { BLOCK: 0, WARN: 1, AI_SUGGEST: 2 } as const;
      return order[a.level] - order[b.level];
    });

    sortedFindings.forEach((finding, idx) => {
      const row = sheet.getRow(12 + idx);
      row.getCell(1).value = finding.row;
      row.getCell(2).value = finding.column;
      row.getCell(3).value = finding.level;
      row.getCell(4).value = finding.message;
      const suggestedStr =
        finding.suggestedValue !== undefined
          ? typeof finding.suggestedValue === 'object'
            ? JSON.stringify(finding.suggestedValue)
            : typeof finding.suggestedValue === 'string'
              ? finding.suggestedValue
              : typeof finding.suggestedValue === 'number' ||
                  typeof finding.suggestedValue === 'boolean'
                ? String(finding.suggestedValue)
                : ''
          : '';
      row.getCell(5).value = suggestedStr;

      // Color by level
      const color = finding.level === 'BLOCK' ? COLOR_BLOCK : COLOR_WARN;
      row.getCell(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };
    });

    // Column widths
    sheet.getColumn(1).width = 8;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 12;
    sheet.getColumn(4).width = 60;
    sheet.getColumn(5).width = 30;
  }

  /**
   * Sheet 2: Data - original data + Color Coding + Cell Comments + Audit Columns (D4)
   */
  private buildDataSheet(
    workbook: ExcelJS.Workbook,
    rows: ExcelCorrespondenceRow[],
    findings: ReviewFinding[]
  ): void {
    const sheet = workbook.addWorksheet(DATA_SHEET_NAME);

    // Header row - data columns + audit columns
    const allColumns = [...DATA_COLUMNS, ...AUDIT_COLUMNS];
    const headerRow = sheet.getRow(1);
    allColumns.forEach((col, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = col;
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD9D9D9' },
      };
      // Audit columns get distinct color
      if (col.startsWith(ANNOTATED_AUDIT_COLUMN_PREFIX)) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE2EFDA' },
        };
      }
    });

    // Build lookup: rowIndex -> findings[]
    const findingsByRow = new Map<number, ReviewFinding[]>();
    for (const f of findings) {
      if (f.row === 0 || f.row === undefined) continue; // global
      const list = findingsByRow.get(f.row) ?? [];
      list.push(f);
      findingsByRow.set(f.row, list);
    }

    // Data rows
    rows.forEach((row, idx) => {
      const excelRow = sheet.getRow(idx + 2); // +1 header, +1 1-based
      excelRow.getCell(1).value = row.documentNumber;
      excelRow.getCell(2).value = row.subject;
      excelRow.getCell(3).value = row.revisionNumber;
      excelRow.getCell(4).value = row.issuedDate
        ? this.formatDate(row.issuedDate)
        : '';
      excelRow.getCell(5).value = row.receivedDate
        ? this.formatDate(row.receivedDate)
        : '';
      excelRow.getCell(6).value = row.senderOrgRaw ?? '';
      excelRow.getCell(7).value = row.receiverOrgRaw ?? '';
      excelRow.getCell(8).value = row.correspondenceTypeCode ?? '';
      excelRow.getCell(9).value = row.disciplineCode ?? '';
      excelRow.getCell(10).value = row.fileName ?? '';
      excelRow.getCell(11).value = row.remarks ?? '';

      // Audit columns - extract from AI_SUGGEST findings
      const rowFindings = findingsByRow.get(row.rowIndex) ?? [];
      const aiSuggestions = rowFindings.filter((f) => f.level === 'AI_SUGGEST');
      const reviewNotes = rowFindings
        .map((f) => `[${f.level}] ${f.message}`)
        .join('\n');

      // [AI] Suggested Subject — รองรับทั้ง finding ที่ column='Subject'
      // และ finding ที่ column='AI Review' ที่มี suggestedValue.subject
      const subjectFromSubjectCol = aiSuggestions.find(
        (f) => f.column === 'Subject'
      )?.suggestedValue;
      const subjectFromAiReview = (
        aiSuggestions.find(
          (f) =>
            f.column === 'AI Review' &&
            typeof f.suggestedValue === 'object' &&
            f.suggestedValue !== null &&
            'subject' in f.suggestedValue
        )?.suggestedValue as { subject?: string } | undefined
      )?.subject;
      const subjectSuggestion = subjectFromSubjectCol ?? subjectFromAiReview;
      excelRow.getCell(12).value =
        typeof subjectSuggestion === 'string' ? subjectSuggestion : '';

      // [AI] Suggested Type — รองรับ finding ที่ column='AI Review'
      // ที่มี suggestedValue.type
      const typeSuggestion = aiSuggestions.find(
        (f) =>
          f.column === 'AI Review' &&
          typeof f.suggestedValue === 'object' &&
          f.suggestedValue !== null &&
          'type' in f.suggestedValue
      );
      const typeValue =
        (typeSuggestion?.suggestedValue as { type?: string } | undefined)
          ?.type ?? '';
      excelRow.getCell(13).value = typeValue;

      // [AI] Review Notes
      excelRow.getCell(14).value = reviewNotes;

      // Cell Color Coding + Cell Comments
      this.applyCellHighlighting(excelRow, rowFindings, allColumns);
    });

    // Column widths
    allColumns.forEach((_, i) => {
      sheet.getColumn(i + 1).width = 20;
    });
  }

  /**
   * Apply color and cell comments based on findings for that row
   */
  private applyCellHighlighting(
    excelRow: ExcelJS.Row,
    rowFindings: ReviewFinding[],
    allColumns: readonly string[]
  ): void {
    for (const finding of rowFindings) {
      // Find column index from column name
      const colIdx = this.findColumnIndex(finding.column, allColumns);
      if (colIdx < 0) continue;

      const cell = excelRow.getCell(colIdx + 1);
      const color = finding.level === 'BLOCK' ? COLOR_BLOCK : COLOR_WARN;

      // Apply color
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: color },
      };

      // Embed Cell Comment (Note)
      const noteText =
        finding.confidence !== undefined
          ? `${finding.message} (Confidence: ${(finding.confidence * 100).toFixed(0)}%)`
          : finding.message;

      cell.note = {
        texts: [{ text: noteText }],
      };
    }
  }

  /**
   * Find column index from name - supports English lowercase match
   */
  private findColumnIndex(
    columnName: string,
    allColumns: readonly string[]
  ): number {
    const lower = columnName.toLowerCase().trim();

    // Exact match
    const exact = allColumns.findIndex((c) => c.toLowerCase() === lower);
    if (exact >= 0) return exact;

    // Match by alias (same as RowBuilder)
    const aliasMap: Record<string, number> = {
      'document number': 0,
      'doc number': 0,
      'doc no': 0,
      subject: 1,
      title: 1,
      revision: 2,
      'issued date': 3,
      'issue date': 3,
      'received date': 4,
      from: 5,
      to: 6,
      type: 7,
      discipline: 8,
      'file name': 9,
      remarks: 10,
    };

    return aliasMap[lower] ?? -1;
  }

  /**
   * Format date as YYYY-MM-DD string (ISO for Excel)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0] ?? '';
  }
}
