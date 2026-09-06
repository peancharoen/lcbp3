// File: backend/src/modules/migration/services/local-ollama-review.adapter.ts
// Change Log:
// - 2026-09-06: Initial creation — Local Ollama AI Reviewer Adapter (T012, FR-008, D2)
//   ใช้ OllamaService ที่มีอยู่แล้ว (np-dms-ai) สำหรับ Layer 3 review
//   ปฏิบัติตาม ADR-023/023A/043: Local AI เท่านั้น, ไม่ส่งข้อมูลออกภายนอก

import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from '../../ai/services/ollama.service';
import { AiReviewerAdapter, AiReviewInput } from './ai-review-provider.factory';
import { AiReviewerProvider, ReviewFinding } from '../types/excel-review.types';

/**
 * LocalOllamaReviewAdapter — Adapter สำหรับ Local Ollama (np-dms-ai)
 *
 * ใช้ OllamaService.generate() ที่มีอยู่แล้ว — ไม่สร้าง connection ใหม่
 * ส่งเฉพาะข้อมูลที่จำเป็น (document number, subject, type code) ไป review
 * ไม่ส่งข้อมูล sensitive เช่น ชื่อหน่วยงานเต็ม, หมายเหตุ ฯลฯ
 *
 * AI ทำงานแบบ Read-Only: คืน AI_SUGGEST findings เท่านั้น ไม่มี BLOCK/WARN
 */
@Injectable()
export class LocalOllamaReviewAdapter implements AiReviewerAdapter {
  private readonly logger = new Logger(LocalOllamaReviewAdapter.name);
  readonly provider: AiReviewerProvider = 'LOCAL_OLLAMA';

  constructor(private readonly ollamaService: OllamaService) {}

  async isAvailable(): Promise<boolean> {
    try {
      // ทดสอบด้วย prompt สั้น ๆ — ถ้า Ollama ไม่ start จะ throw
      const result = await this.ollamaService.generate('ping', {
        timeoutMs: 5000,
      });
      return typeof result === 'string';
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.debug(`Ollama availability check failed: ${detail}`);
      return false;
    }
  }

  async review(input: AiReviewInput): Promise<ReviewFinding[]> {
    const findings: ReviewFinding[] = [];

    // ประมวลผลทีละแถว — ส่งเฉพาะ field ที่จำเป็น
    for (const row of input.rows) {
      // ข้ามแถวที่มี BLOCK อยู่แล้ว — AI ไม่ต้อง review แถวที่ผิดกฎอยู่แล้ว
      const hasBlock = row.findings.some((f) => f.level === 'BLOCK');
      if (hasBlock) {
        continue;
      }

      const prompt = this.buildPrompt(row);
      try {
        const response = await this.ollamaService.generate(prompt, {
          format: 'json',
          timeoutMs: 30000,
        });
        const suggestion = this.parseResponse(response, row.rowIndex);
        if (suggestion) {
          findings.push(suggestion);
        }
      } catch (err: unknown) {
        // ไม่ throw — แค่ log และข้ามแถวนี้ (Fail-Open ต่อแถว)
        const detail = err instanceof Error ? err.message : 'unknown';
        this.logger.debug(
          `Ollama review ล้มเหลวสำหรับแถว ${row.rowIndex}: ${detail}`
        );
      }
    }

    return findings;
  }

  /**
   * สร้าง prompt สำหรับ AI review — ส่งเฉพาะข้อมูลจำเป็น
   * ไม่ส่ง ชื่อหน่วยงานเต็ม, หมายเหตุ, ชื่อไฟล์ (ข้อมูล sensitive)
   */
  private buildPrompt(row: {
    documentNumber: string;
    subject: string;
    correspondenceTypeCode?: string;
    disciplineCode?: string;
  }): string {
    return JSON.stringify({
      task: 'review_correspondence_row',
      documentNumber: row.documentNumber,
      subject: row.subject,
      typeCode: row.correspondenceTypeCode ?? '',
      disciplineCode: row.disciplineCode ?? '',
      instructions:
        'ตรวจสอบความสอดคล้องระหว่าง subject กับ typeCode และ disciplineCode หากพบความไม่สอดคล้อง แนะนำค่าที่ถูกต้อง หาก subject มี typo หรือไม่ชัดเจน แนะนำ subject ที่แก้ไขแล้วด้วย คืน JSON {suggestedSubject, suggestedType, suggestedDiscipline, confidence, reason}',
    });
  }

  /**
   * Parse ผลลัพธ์จาก AI — แปลงเป็น ReviewFinding ระดับ AI_SUGGEST
   * ถ้า response ไม่ใช่ JSON หรือไม่มี suggestion จะคืน undefined
   */
  private parseResponse(
    response: string,
    rowIndex: number
  ): ReviewFinding | undefined {
    try {
      const parsed = JSON.parse(response) as {
        suggestedSubject?: string;
        suggestedType?: string;
        suggestedDiscipline?: string;
        confidence?: number;
        reason?: string;
      };
      if (
        !parsed.suggestedSubject &&
        !parsed.suggestedType &&
        !parsed.suggestedDiscipline &&
        !parsed.reason
      ) {
        return undefined;
      }
      const messages: string[] = [];
      if (parsed.suggestedSubject) {
        messages.push(`แนะนำเรื่อง: ${parsed.suggestedSubject}`);
      }
      if (parsed.suggestedType) {
        messages.push(`แนะนำประเภท: ${parsed.suggestedType}`);
      }
      if (parsed.suggestedDiscipline) {
        messages.push(`แนะนำสาขา: ${parsed.suggestedDiscipline}`);
      }
      if (parsed.reason) {
        messages.push(`เหตุผล: ${parsed.reason}`);
      }
      return {
        row: rowIndex,
        column: 'AI Review',
        level: 'AI_SUGGEST',
        message: messages.join(' | '),
        originalValue: undefined,
        suggestedValue: {
          subject: parsed.suggestedSubject,
          type: parsed.suggestedType,
          discipline: parsed.suggestedDiscipline,
        },
        confidence:
          typeof parsed.confidence === 'number'
            ? Math.max(0, Math.min(1, parsed.confidence))
            : undefined,
      };
    } catch {
      // response ไม่ใช่ JSON ที่ถูกต้อง — ข้าม
      return undefined;
    }
  }
}
