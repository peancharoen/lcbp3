// File: src/modules/ai/services/sandbox-ocr-engine.service.ts
// Change Log
// - 2026-05-30: แยก SandboxOcrEngineService ออกจาก OcrService เพื่อรองรับการเลือก np-dms-ocr เฉพาะ sandbox โดยไม่กระทบ core OCR flow
// - 2026-06-01: เปลี่ยนจาก remapPath + pdfPath ไปเป็น multipart file upload ไปยัง /ocr-upload (แก้ปัญหา Docker WSL2 mount)
// - 2026-06-02: ส่งค่า X-API-Key ใน request headers ไปยัง ocr-sidecar เพื่อความมั่นคงปลอดภัยสูงสุด (ADR-033, Suggestion 2)
// - 2026-06-04: ADR-034 — เพิ่ม 'np-dms-ocr' เป็น canonical SandboxOcrEngineType
// - 2026-06-04: เพิ่ม OcrNpDmsOptions interface; รับ temperature/topP/repeatPenalty จาก frontend sandbox เพื่อ override Modelfile defaults
// - 2026-06-13: ADR-036 — เปลี่ยน canonical SandboxOcrEngineType เป็น np-dms-ocr
// - 2026-06-17: เพิ่ม AiPromptsService injection และส่ง systemPrompt form field จาก active ocr_system prompt (T028)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import * as fs from 'fs';
import { OcrService } from './ocr.service';
import { AiPromptsService } from '../prompts/ai-prompts.service';
import { AiExecutionProfile } from '../entities/ai-execution-profile.entity';
import { BusinessException } from '../../../common/exceptions';

export type SandboxOcrEngineType = 'auto' | 'np-dms-ocr';

/** ค่า parameter สำหรับ np-dms-ocr ที่ override Modelfile defaults ได้จาก sandbox UI */
export interface OcrNpDmsOptions {
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
    private readonly ocrService: OcrService,
    private readonly aiPromptsService: AiPromptsService,
    @InjectRepository(AiExecutionProfile)
    private readonly profileRepo: Repository<AiExecutionProfile>
  ) {
    this.ocrApiUrl = this.configService.get<string>(
      'OCR_API_URL',
      'http://localhost:8765'
    );
    const ocrSidecarApiKey = this.configService.get<string>(
      'OCR_SIDECAR_API_KEY'
    );
    if (!ocrSidecarApiKey) {
      throw new Error(
        'OCR_SIDECAR_API_KEY is required — กรุณาตั้งค่า environment variable'
      );
    }
    this.ocrSidecarApiKey = ocrSidecarApiKey;
  }

  /** รัน OCR ตาม engine ที่เลือก โดย fallback กลับไป fast-path เมื่อ np-dms-ocr ล้มเหลว */
  async detectAndExtract(
    pdfPath: string,
    engineType: SandboxOcrEngineType = 'auto',
    ocrOptions?: OcrNpDmsOptions
  ): Promise<SandboxOcrResult> {
    const resolvedEngineType = engineType;
    this.logger.log(
      `detectAndExtract called — engine="${resolvedEngineType}" pdfPath="${pdfPath}" ocrOptions=${JSON.stringify(ocrOptions ?? null)}`
    );
    if (resolvedEngineType === 'auto') {
      this.logger.log(`engine="${resolvedEngineType}" → routing to fast-path`);
      const result = await this.ocrService.detectAndExtract({ pdfPath });
      return {
        text: result.text,
        ocrUsed: result.ocrUsed,
        engineUsed: result.ocrUsed ? 'fast-path' : 'fast-path',
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

      // Resolve runtime parameters from DB (ocr-extract profile)
      const profile = await this.profileRepo.findOne({
        where: { profileName: 'ocr-extract' },
      });
      const runtimeParams = {
        temperature: profile ? Number(profile.temperature) : 0.1,
        top_p: profile ? Number(profile.topP) : 0.5,
        repeat_penalty: profile ? Number(profile.repeatPenalty) : 1.0,
        max_tokens: profile?.maxTokens ?? 16000,
      };

      // Override with sandbox options if provided
      if (ocrOptions?.temperature !== undefined) {
        runtimeParams.temperature = ocrOptions.temperature;
      }
      if (ocrOptions?.topP !== undefined) {
        runtimeParams.top_p = ocrOptions.topP;
      }
      if (ocrOptions?.repeatPenalty !== undefined) {
        runtimeParams.repeat_penalty = ocrOptions.repeatPenalty;
      }

      // Resolve Active Prompt from DB (ocr_extraction)
      const activePrompt =
        await this.aiPromptsService.getActive('ocr_extraction');
      if (!activePrompt) {
        throw new BusinessException(
          'NO_ACTIVE_PROMPT',
          'No active ocr_extraction prompt found',
          'ไม่พบ Prompt OCR สำหรับดึงข้อมูลที่เปิดใช้งาน'
        );
      }
      const systemPrompt = activePrompt.template;
      const dmsTags = activePrompt.contextConfig?.dmsTags;

      const form = new FormData();
      form.append(
        'file',
        new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' }),
        'upload.pdf'
      );
      form.append('engine', resolvedEngineType);
      form.append('systemPrompt', systemPrompt);
      if (dmsTags) {
        form.append('dmsTags', JSON.stringify(dmsTags));
      }
      form.append('runtimeParams', JSON.stringify(runtimeParams));

      // Append individual overrides for backward compatibility
      form.append('temperature', String(runtimeParams.temperature));
      form.append('topP', String(runtimeParams.top_p));
      form.append('repeatPenalty', String(runtimeParams.repeat_penalty));

      this.logger.log(
        `Sending to sidecar — engine=${engineType} options=${JSON.stringify(ocrOptions ?? {})}`
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
        `[DIAG] np-dms-ocr FAILED — engine="${engineType}" url="${this.ocrApiUrl}/ocr-upload" error: ${fullCause}`
      );
      this.logger.warn(`Falling back to fast-path due to: ${fullCause}`);

      const fallbackResult = await this.ocrService.detectAndExtract({
        pdfPath,
      });
      return {
        text: fallbackResult.text,
        ocrUsed: fallbackResult.ocrUsed,
        engineUsed: fallbackResult.ocrUsed ? 'fast-path' : 'fast-path',
        fallbackUsed: true,
      };
    }
  }
}
