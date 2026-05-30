// File: src/modules/ai/services/sandbox-ocr-engine.service.ts
// Change Log
// - 2026-05-30: แยก SandboxOcrEngineService ออกจาก OcrService เพื่อรองรับการเลือก Typhoon OCR เฉพาะ sandbox โดยไม่กระทบ core OCR flow

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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
  private readonly localUploadBase: string;
  private readonly sidecarUploadBase: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly ocrService: OcrService
  ) {
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
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
      const response = await axios.post<SandboxOcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr`,
        {
          pdfPath: this.remapPath(pdfPath),
          engine: engineType,
        },
        { timeout: 120000 }
      );

      return {
        text: response.data.text ?? '',
        ocrUsed: response.data.ocrUsed ?? true,
        engineUsed: response.data.engineUsed ?? engineType,
        fallbackUsed: false,
      };
    } catch (error: unknown) {
      const cause = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Typhoon OCR failed in sandbox, falling back to Tesseract: ${cause}`
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
