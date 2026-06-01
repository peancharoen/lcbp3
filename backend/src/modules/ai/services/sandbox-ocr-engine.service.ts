// File: src/modules/ai/services/sandbox-ocr-engine.service.ts
// Change Log
// - 2026-05-30: แยก SandboxOcrEngineService ออกจาก OcrService เพื่อรองรับการเลือก Typhoon OCR เฉพาะ sandbox โดยไม่กระทบ core OCR flow
// - 2026-06-01: เปลี่ยนจาก remapPath + pdfPath ไปเป็น multipart file upload ไปยัง /ocr-upload (แก้ปัญหา Docker WSL2 mount)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { OcrService } from './ocr.service';

export type SandboxOcrEngineType = 'auto' | 'tesseract' | 'typhoon-ocr-3b';

interface SandboxOcrSidecarResponse {
  text?: string;
  ocrUsed?: boolean;
  engineUsed?: string;
}

export interface SandboxOcrResult {
  text: string;
  ocrUsed: boolean;
  engineUsed: string;
  fallbackUsed: boolean;
}

/** บริการ OCR สำหรับ sandbox เท่านั้น เพื่อแยก blast radius ออกจาก OcrService หลัก */
@Injectable()
export class SandboxOcrEngineService {
  private readonly logger = new Logger(SandboxOcrEngineService.name);
  private readonly ocrApiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ocrService: OcrService
  ) {
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
  }

  /** รัน OCR ตาม engine ที่เลือก โดย fallback กลับไป Tesseract baseline เมื่อ Typhoon ล้มเหลว */
  async detectAndExtract(
    pdfPath: string,
    engineType: SandboxOcrEngineType = 'auto'
  ): Promise<SandboxOcrResult> {
    if (engineType === 'auto' || engineType === 'tesseract') {
      const result = await this.ocrService.detectAndExtract({ pdfPath });
      return {
        text: result.text,
        ocrUsed: result.ocrUsed,
        engineUsed: result.ocrUsed ? 'tesseract' : 'fast-path',
        fallbackUsed: false,
      };
    }

    try {
      const fileBuffer = fs.readFileSync(pdfPath);
      const form = new FormData();
      form.append(
        'file',
        new Blob([fileBuffer], { type: 'application/pdf' }),
        'upload.pdf'
      );
      form.append('engine', engineType);
      const response = await axios.post<SandboxOcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr-upload`,
        form,
        { timeout: 120000 }
      );

      return {
        text: response.data.text ?? '',
        ocrUsed: response.data.ocrUsed ?? true,
        engineUsed: response.data.engineUsed ?? engineType,
        fallbackUsed: false,
      };
    } catch (error: unknown) {
      // ดึง axios response body detail ออกมาด้วย (เช่น ไม่พบไฟล์: /mnt/uploads/...)
      const axiosDetail =
        error !== null &&
        typeof error === 'object' &&
        'response' in error &&
        error.response !== null &&
        typeof error.response === 'object' &&
        'data' in error.response &&
        error.response.data !== null &&
        typeof error.response.data === 'object' &&
        'detail' in error.response.data
          ? String((error.response.data as { detail: unknown }).detail)
          : null;
      const cause = error instanceof Error ? error.message : String(error);
      const fullCause = axiosDetail
        ? `${cause} — sidecar detail: ${axiosDetail}`
        : cause;
      this.logger.warn(
        `Typhoon OCR failed in sandbox, falling back to Tesseract: ${fullCause}`
      );

      const fallbackResult = await this.ocrService.detectAndExtract({
        pdfPath,
      });
      return {
        text: fallbackResult.text,
        ocrUsed: fallbackResult.ocrUsed,
        engineUsed: fallbackResult.ocrUsed ? 'tesseract' : 'fast-path',
        fallbackUsed: true,
      };
    }
  }
}
