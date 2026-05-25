// File: src/modules/ai/services/ocr.service.ts
// Change Log
// - 2026-05-15: เพิ่ม OCR auto-detection service สำหรับ ADR-023A.
// - 2026-05-25: แก้ไข AggregateError (empty message) จาก axios โดย wrap เป็น Error พร้อม context ที่ชัดเจน.
// - 2026-05-25: เพิ่ม path remapping (OCR_UPLOAD_BASE_PATH) เพื่อแปลง local upload path เป็น path ที่ sidecar เห็นผ่าน CIFS.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OcrDetectionInput {
  extractedText?: string;
  extractedChars?: number;
  pdfPath?: string;
}

export interface OcrDetectionResult {
  text: string;
  ocrUsed: boolean;
}

interface PaddleOcrResponse {
  text?: string;
}

/** บริการเลือก fast path หรือ PaddleOCR sidecar ตามจำนวนตัวอักษรที่ extract ได้ */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  private readonly threshold: number;
  private readonly ocrApiUrl: string;
  private readonly localUploadBase: string;
  private readonly sidecarUploadBase: string;

  constructor(private readonly configService: ConfigService) {
    this.threshold = this.configService.get<number>('OCR_CHAR_THRESHOLD', 100);
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
    // path ที่ backend เห็น → path ที่ sidecar เห็น (ผ่าน CIFS mount)
    this.localUploadBase = this.configService
      .get<string>('UPLOAD_PERMANENT_DIR', '/app/uploads/permanent')
      .replace(/\/permanent$/, '');
    this.sidecarUploadBase = this.configService.get<string>(
      'OCR_SIDECAR_UPLOAD_BASE',
      '/mnt/uploads'
    );
  }

  /** แปลง local upload path เป็น path ที่ sidecar เห็นผ่าน CIFS mount */
  private remapPath(localPath: string): string {
    if (this.localUploadBase && localPath.startsWith(this.localUploadBase)) {
      return localPath.replace(this.localUploadBase, this.sidecarUploadBase);
    }
    return localPath;
  }

  /** ตรวจสอบ text layer ก่อนเลือก OCR slow path */
  async detectAndExtract(
    input: OcrDetectionInput
  ): Promise<OcrDetectionResult> {
    const extractedText = input.extractedText ?? '';
    const extractedChars = input.extractedChars ?? extractedText.length;

    if (extractedChars > this.threshold) {
      return { text: extractedText, ocrUsed: false };
    }

    if (!input.pdfPath) {
      this.logger.warn('OCR slow path skipped because pdfPath is missing');
      return { text: extractedText, ocrUsed: false };
    }

    try {
      const sidecarPath = this.remapPath(input.pdfPath);
      this.logger.debug(`OCR path remap: ${input.pdfPath} → ${sidecarPath}`);
      const response = await axios.post<PaddleOcrResponse>(
        `${this.ocrApiUrl}/ocr`,
        { pdfPath: sidecarPath },
        { timeout: 90000 }
      );
      return {
        text: response.data.text ?? '',
        ocrUsed: true,
      };
    } catch (err: unknown) {
      const cause =
        err instanceof AggregateError && err.errors?.length
          ? err.errors
              .map((e: unknown) => (e instanceof Error ? e.message : String(e)))
              .join('; ')
          : err instanceof Error
            ? err.message
            : String(err);
      throw new Error(
        `PaddleOCR sidecar unreachable at ${this.ocrApiUrl} — ${cause}`
      );
    }
  }
}
