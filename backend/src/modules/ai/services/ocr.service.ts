// File: src/modules/ai/services/ocr.service.ts
// Change Log
// - 2026-05-15: เพิ่ม OCR auto-detection service สำหรับ ADR-023A.

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

  constructor(private readonly configService: ConfigService) {
    this.threshold = this.configService.get<number>('OCR_CHAR_THRESHOLD', 100);
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
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

    const response = await axios.post<PaddleOcrResponse>(
      `${this.ocrApiUrl}/ocr`,
      { pdfPath: input.pdfPath },
      { timeout: 90000 }
    );

    return {
      text: response.data.text ?? '',
      ocrUsed: true,
    };
  }
}
