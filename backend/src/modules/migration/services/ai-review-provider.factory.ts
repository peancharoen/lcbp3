// File: backend/src/modules/migration/services/ai-review-provider.factory.ts
// Change Log:
// - 2026-09-06: Initial creation — AI Review Provider Factory (T012, FR-008, D2)
//   Multi-tier AI Reviewer: LOCAL_OLLAMA (default) → GEMINI → CLAUDE
//   ทำงานแบบ Read-Only และ Fail-Open (FR-009) — ไม่ขัดขวางกระบวนการนำเข้า
//   ปฏิบัติตาม ADR-023/023A/043: AI อยู่หลัง backend gateway, ไม่เข้า DB/storage โดยตรง
//   Local AI เป็น default; External AI ต้องมี ALLOW_EXTERNAL_AI_REVIEW=true

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiReviewerProvider,
  BatchStrategy,
  ExcelCorrespondenceRow,
  ReviewFinding,
} from '../types/excel-review.types';

/**
 * Injection token สำหรับ adapter array — ต้องใช้เพราะ NestJS
 * ไม่สามารถ resolve interface array ได้โดยตรง
 */
export const AI_REVIEWER_ADAPTERS = 'AI_REVIEWER_ADAPTERS';

/**
 * ผลลัพธ์การ review ของ Layer 3 AI Reviewer
 * - findings: คำแนะนำระดับ AI_SUGGEST (Human-in-the-loop เท่านั้น)
 * - available: ระบุว่า AI พร้อมใช้งานหรือไม่ (false = fail-open)
 */
export interface AiReviewResult {
  available: boolean;
  findings: ReviewFinding[];
  /** ข้อความแจ้งเตือนเมื่อ AI ไม่พร้อมใช้งาน (Fail-Open) */
  unavailableReason?: string;
}

/**
 * Input สำหรับ AI Reviewer
 * - rows: แถวข้อมูลที่ผ่าน Layer 1 + Layer 2 แล้ว
 * - projectPublicId: สำหรับ audit context (ไม่ส่งข้อมูล sensitive ออก external AI)
 * - batchStrategy: กลยุทธ์การ sampling (FULL หรือ FAST_SELECTIVE)
 */
export interface AiReviewInput {
  rows: ExcelCorrespondenceRow[];
  projectPublicId: string;
  provider: AiReviewerProvider;
  batchStrategy: BatchStrategy;
}

/**
 * Interface สำหรับ AI Reviewer Adapter แต่ละ provider
 * ทุก adapter ต้อง implement ตามนี้ — ทำให้ factory เลือกได้ตาม provider
 */
export interface AiReviewerAdapter {
  /** ชื่อ provider */
  readonly provider: AiReviewerProvider;
  /** ตรวจสอบว่า adapter นี้พร้อมใช้งานหรือไม่ (เช่น Ollama ยังไม่ start) */
  isAvailable(): Promise<boolean>;
  /** รัน review — คืน findings ระดับ AI_SUGGEST */
  review(input: AiReviewInput): Promise<ReviewFinding[]>;
}

/**
 * AiReviewProviderFactory — Layer 3 AI Reviewer (T012, FR-008, D2)
 *
 * หน้าที่:
 * - เลือก adapter ตาม provider ที่ผู้ใช้เลือก (LOCAL_OLLAMA / GEMINI / CLAUDE)
 * - ตรวจสอบ availability ก่อนเรียก — ถ้าไม่พร้อม คืน fail-open result
 * - ไม่ส่งข้อมูล sensitive ไปยัง external AI นอกจากได้รับอนุญาต
 * - ทุก error ถูก catch และแปลงเป็น fail-open (FR-009)
 *
 * ข้อกำหนด ADR-023/023A/043:
 * - AI อยู่หลัง backend gateway เท่านั้น
 * - ไม่เข้าถึง DB/storage โดยตรง
 * - Local AI เป็น default
 * - Human-in-the-loop (AI_SUGGEST ไม่ใช่ BLOCK)
 */
@Injectable()
export class AiReviewProviderFactory {
  private readonly logger = new Logger(AiReviewProviderFactory.name);
  private readonly allowExternalAi: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Inject(AI_REVIEWER_ADAPTERS)
    private readonly adapters: AiReviewerAdapter[]
  ) {
    this.allowExternalAi =
      this.configService.get<string>('ALLOW_EXTERNAL_AI_REVIEW') === 'true';
  }

  /**
   * รัน AI review ตาม provider ที่เลือก — Fail-Open เสมอ (FR-009)
   *
   * ถ้า provider ไม่พร้อม หรือเกิด error ใด ๆ จะคืน:
   * { available: false, findings: [], unavailableReason: '...' }
   * และกระบวนการนำเข้าจะดำเนินต่อโดยใช้ผลจาก Layer 1 + Layer 2 เท่านนั้น
   */
  async review(input: AiReviewInput): Promise<AiReviewResult> {
    // External AI ต้องมี flag ALLOW_EXTERNAL_AI_REVIEW=true (D2)
    if (input.provider !== 'LOCAL_OLLAMA' && !this.allowExternalAi) {
      this.logger.warn(
        `External AI (${input.provider}) ถูกปิดใช้งาน — ALLOW_EXTERNAL_AI_REVIEW ไม่เป็น true — Fail-Open`
      );
      return {
        available: false,
        findings: [],
        unavailableReason:
          'การใช้ External AI ถูกปิดใช้งาน — กรุณาติดต่อผู้ดูแลระบบ',
      };
    }

    // ค้นหา adapter — wrap ใน try/catch เพื่อ Fail-Open (FR-009)
    // ถ้า adapters array ไม่ถูก inject หรือเกิด error ใด ๆ จะไม่ขัดขวางกระบวนการ
    let adapter: AiReviewerAdapter | undefined;
    try {
      adapter = this.adapters?.find((a) => a.provider === input.provider);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`ค้นหา adapter ล้มเหลว: ${detail} — Fail-Open`);
      return {
        available: false,
        findings: [],
        unavailableReason: `ระบบ AI ไม่พร้อมใช้งานในขณะนี้`,
      };
    }
    if (!adapter) {
      this.logger.warn(
        `ไม่พบ adapter สำหรับ provider "${input.provider}" — Fail-Open`
      );
      return {
        available: false,
        findings: [],
        unavailableReason: `ไม่รองรับ AI provider "${input.provider}"`,
      };
    }

    // ตรวจ availability ก่อน — ไม่ throw ถ้าไม่พร้อม
    try {
      const available = await adapter.isAvailable();
      if (!available) {
        this.logger.warn(
          `AI provider "${input.provider}" ไม่พร้อมใช้งาน — Fail-Open`
        );
        return {
          available: false,
          findings: [],
          unavailableReason: `AI provider "${input.provider}" ไม่พร้อมใช้งานในขณะนี้`,
        };
      }
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `ตรวจ availability ของ "${input.provider}" ล้มเหลว: ${detail} — Fail-Open`
      );
      return {
        available: false,
        findings: [],
        unavailableReason: `ไม่สามารถตรวจสอบสถานะ AI ได้: ${detail}`,
      };
    }

    // รัน review — catch ทุก error เพื่อ Fail-Open
    try {
      const findings = await adapter.review(input);
      this.logger.log(
        `AI review เสร็จ: provider=${input.provider}, rows=${input.rows.length}, suggestions=${findings.length}`
      );
      return { available: true, findings };
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(
        `AI review ล้มเหลว (provider=${input.provider}): ${detail} — Fail-Open`
      );
      return {
        available: false,
        findings: [],
        unavailableReason: `AI review ไม่สามารถทำงานได้: ${detail}`,
      };
    }
  }
}
