// File: backend/src/modules/migration/services/claude-review.adapter.ts
// Change Log:
// - 2026-09-11: Initial creation — Claude AI Reviewer Adapter skeleton (Phase D, FR-008, D2)
//   ใช้ Anthropic Claude API สำหรับ Layer 3 review (External AI — ต้องมี Admin + ALLOW_EXTERNAL_AI_REVIEW=true)
//   ปฏิบัติตาม ADR-023/023A/043: External AI อยู่หลัง backend gateway, Fail-Open เสมอ (FR-009)
//   ส่งเฉพาะข้อมูลที่จำเป็น (document number, subject, type code) — ไม่ส่งข้อมูล sensitive

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { AiReviewerAdapter, AiReviewInput } from './ai-review-provider.factory';
import { AiReviewerProvider, ReviewFinding } from '../types/excel-review.types';

/**
 * ClaudeReviewAdapter — Adapter สำหรับ Anthropic Claude API (FR-008, D2)
 *
 * ใช้ Claude 3 สำหรับ Layer 3 review — ส่งเฉพาะข้อมูลจำเป็น
 * ไม่ส่งข้อมูล sensitive เช่น ชื่อหน่วยงานเต็ม, หมายเหตุ ฯลฯ
 *
 * AI ทำงานแบบ Read-Only: คืน AI_SUGGEST findings เท่านั้น ไม่มี BLOCK/WARN
 * Fail-Open: ถ้า API key ไม่มี, API ล้มเหลว, หรือ rate limit — คืน [] (FR-009)
 */
@Injectable()
export class ClaudeReviewAdapter implements AiReviewerAdapter {
  private readonly logger = new Logger(ClaudeReviewAdapter.name);
  readonly provider: AiReviewerProvider = 'CLAUDE';

  private readonly apiKey: string | undefined;
  private httpClient: AxiosInstance;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('CLAUDE_API_KEY');
    this.httpClient = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 30000,
      headers: {
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });
  }

  isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.debug('Claude API key ไม่ได้ตั้งค่า — ไม่พร้อมใช้งาน');
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  async review(input: AiReviewInput): Promise<ReviewFinding[]> {
    if (!this.apiKey) {
      this.logger.warn('Claude API key ไม่ได้ตั้งค่า — Fail-Open');
      return [];
    }

    const findings: ReviewFinding[] = [];

    for (const row of input.rows) {
      // ข้ามแถวที่มี BLOCK finding อยู่แล้ว
      const hasBlock = row.findings.some((f) => f.level === 'BLOCK');
      if (hasBlock) {
        continue;
      }

      const prompt = this.buildPrompt(row);
      try {
        const response = await this.httpClient.post(
          '/messages',
          {
            model: 'claude-3-sonnet-20240229',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          },
          {
            headers: { 'x-api-key': this.apiKey },
          }
        );
        const text = this.extractText(
          response.data as {
            content?: Array<{ type: string; text?: string }>;
          }
        );
        const suggestion = this.parseResponse(text, row.rowIndex);
        if (suggestion) {
          findings.push(suggestion);
        }
      } catch (err: unknown) {
        // Fail-Open ต่อแถว — ไม่ throw
        const detail = err instanceof Error ? err.message : 'unknown';
        this.logger.debug(
          `Claude review ล้มเหลวสำหรับแถว ${row.rowIndex}: ${detail}`
        );
      }
    }

    return findings;
  }

  /**
   * สร้าง prompt สำหรับ AI review — ส่งเฉพาะข้อมูลจำเป็น
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
   * ดึง text จาก Claude API response
   */
  private extractText(data: {
    content?: Array<{ type: string; text?: string }>;
  }): string {
    return data?.content?.[0]?.text ?? '';
  }

  /**
   * Parse ผลลัพธ์จาก AI — แปลงเป็น ReviewFinding ระดับ AI_SUGGEST
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
      return undefined;
    }
  }
}
