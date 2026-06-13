// File: src/modules/ai/services/sandbox-ocr-engine.service.ts
// Change Log
// - 2026-05-30: แยก SandboxOcrEngineService ออกจาก OcrService เพื่อรองรับการเลือก Typhoon OCR เฉพาะ sandbox โดยไม่กระทบ core OCR flow
// - 2026-06-01: เปลี่ยนจาก remapPath + pdfPath ไปเป็น multipart file upload ไปยัง /ocr-upload (แก้ปัญหา Docker WSL2 mount)
// - 2026-06-02: ส่งค่า X-API-Key ใน request headers ไปยัง ocr-sidecar เพื่อความมั่นคงปลอดภัยสูงสุด (ADR-033, Suggestion 2)
// - 2026-06-04: ADR-034 — เพิ่ม 'typhoon-np-dms-ocr' เป็น canonical SandboxOcrEngineType; legacy aliases ยังรองรับ
// - 2026-06-04: เพิ่ม OcrTyphoonOptions interface; รับ temperature/topP/repeatPenalty จาก frontend sandbox เพื่อ override Modelfile defaults
// - 2026-06-13: ADR-036 — เปลี่ยน canonical SandboxOcrEngineType เป็น np-dms-ocr และคง legacy alias

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import { OcrService } from './ocr.service';

export type SandboxOcrEngineType =
  | 'auto'
  | 'tesseract'
  | 'np-dms-ocr'
  | 'typhoon-np-dms-ocr';

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
    const resolvedEngineType =
      engineType === 'typhoon-np-dms-ocr' ? 'np-dms-ocr' : engineType;
    this.logger.log(
      `detectAndExtract called — engine="${resolvedEngineType}" pdfPath="${pdfPath}" typhoonOptions=${JSON.stringify(typhoonOptions ?? null)}`
    );
    if (resolvedEngineType === 'auto' || resolvedEngineType === 'tesseract') {
      this.logger.log(
        `engine="${resolvedEngineType}" → routing to Tesseract/fast-path`
      );
      const result = await this.ocrService.detectAndExtract({ pdfPath });
      return {
        text: result.text,
        ocrUsed: result.ocrUsed,
        engineUsed: result.ocrUsed ? 'tesseract' : 'fast-path',
        fallbackUsed: false,
      };
    }

    this.logger.log(
      `engine="np-dms-ocr" → calling sidecar at ${this.ocrApiUrl}/ocr-upload`
    );
    try {
      let fileBuffer: Buffer;
      try {
        fileBuffer = fs.readFileSync(pdfPath);
        this.logger.log(
          `File read OK — ${fileBuffer.length} bytes from "${pdfPath}"`
        );
      } catch (fsErr: unknown) {
        const fsMsg = fsErr instanceof Error ? fsErr.message : String(fsErr);
        this.logger.error(
          `[DIAG] fs.readFileSync FAILED — "${pdfPath}": ${fsMsg}`
        );
        throw fsErr;
      }
      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }),
        'upload.pdf'
      );
      form.append('engine', resolvedEngineType);
      if (typhoonOptions?.temperature !== undefined) {
        form.append('temperature', String(typhoonOptions.temperature));
      }
      if (typhoonOptions?.topP !== undefined) {
        form.append('topP', String(typhoonOptions.topP));
      }
      if (typhoonOptions?.repeatPenalty !== undefined) {
        form.append('repeatPenalty', String(typhoonOptions.repeatPenalty));
      }
      this.logger.log(
        `Sending to sidecar — engine=${engineType} options=${JSON.stringify(typhoonOptions ?? {})}`
      );
      const response = await axios.post<SandboxOcrSidecarResponse>(
        `${this.ocrApiUrl}/ocr-upload`,
        form,
        {
          timeout: 360000, // 360s — รองรับ cold-start Ollama model (~65s) + inference หลายหน้า
          headers: { 'X-API-Key': this.ocrSidecarApiKey },
        }
      );
      this.logger.log(
        `Sidecar response OK — engineUsed="${response.data.engineUsed}" ocrUsed=${String(response.data.ocrUsed)} textLen=${String(response.data.text?.length ?? 0)}`
      );

      return {
        text: response.data.text ?? '',
        ocrUsed: response.data.ocrUsed ?? true,
        engineUsed: response.data.engineUsed ?? resolvedEngineType,
        fallbackUsed: false,
      };
    } catch (error: unknown) {
      // ดึง HTTP status + body detail จาก axios error
      const axiosStatus =
        error !== null &&
        typeof error === 'object' &&
        'response' in error &&
        error.response !== null &&
        typeof error.response === 'object' &&
        'status' in error.response
          ? String((error.response as { status: unknown }).status)
          : 'N/A';
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
        ? `HTTP ${axiosStatus} — ${cause} — sidecar detail: ${axiosDetail}`
        : `HTTP ${axiosStatus} — ${cause}`;
      this.logger.error(
        `[DIAG] Typhoon OCR FAILED — engine="${engineType}" url="${this.ocrApiUrl}/ocr-upload" error: ${fullCause}`
      );
      this.logger.warn(`Falling back to Tesseract due to: ${fullCause}`);

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
