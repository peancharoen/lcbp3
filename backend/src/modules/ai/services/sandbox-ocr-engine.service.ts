// File: src/modules/ai/services/sandbox-ocr-engine.service.ts
// Change Log
// - 2026-05-30: แยก SandboxOcrEngineService ออกจาก OcrService เพื่อรองรับการเลือก Typhoon OCR เฉพาะ sandbox โดยไม่กระทบ core OCR flow
// - 2026-06-01: เปลี่ยนจาก remapPath + pdfPath ไปเป็น multipart file upload ไปยัง /ocr-upload (แก้ปัญหา Docker WSL2 mount)
// - 2026-06-02: ส่งค่า X-API-Key ใน request headers ไปยัง ocr-sidecar เพื่อความมั่นคงปลอดภัยสูงสุด (ADR-033, Suggestion 2)
// - 2026-06-04: ADR-034 — เพิ่ม 'typhoon-np-dms-ocr' เป็น canonical SandboxOcrEngineType; legacy aliases ยังรองรับ
// - 2026-06-04: เพิ่ม OcrTyphoonOptions interface; รับ temperature/topP/repeatPenalty จาก frontend sandbox เพื่อ override Modelfile defaults

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { OcrService } from './ocr.service';

export type SandboxOcrEngineType = 'auto' | 'tesseract' | 'typhoon-np-dms-ocr';

/** ค่า parameter สำหรับ Typhoon OCR ที่ override Modelfile defaults ได้จาก sandbox UI */
export interface OcrTyphoonOptions {
  temperature?: number;
  topP?: number;
  repeatPenalty?: number;
}

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
  private readonly ocrSidecarApiKey: string;
  constructor(
    private readonly configService: ConfigService,
    private readonly ocrService: OcrService
  ) {
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
    this.ocrSidecarApiKey = this.configService.get<string>(
      'OCR_SIDECAR_API_KEY',
      'lcbp3-dms-ocr-sidecar-secure-token-2026'
    );
  }

  /** รัน OCR ตาม engine ที่เลือก โดย fallback กลับไป Tesseract baseline เมื่อ Typhoon ล้มเหลว */
  async detectAndExtract(
    pdfPath: string,
    engineType: SandboxOcrEngineType = 'auto',
    typhoonOptions?: OcrTyphoonOptions
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
      if (typhoonOptions?.temperature !== undefined) {
        form.append('temperature', String(typhoonOptions.temperature));
      }
      if (typhoonOptions?.topP !== undefined) {
        form.append('topP', String(typhoonOptions.topP));
      }
      if (typhoonOptions?.repeatPenalty !== undefined) {
        form.append('repeatPenalty', String(typhoonOptions.repeatPenalty));
      }
      const response = await axios.post<SandboxOcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr-upload`,
        form,
        {
          timeout: 120000,
          headers: { 'X-API-Key': this.ocrSidecarApiKey },
        }
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
