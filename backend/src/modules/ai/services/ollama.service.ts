// File: src/modules/ai/services/ollama.service.ts
// Change Log
// - 2026-05-15: เพิ่ม Ollama service สำหรับ ADR-023A 2-model stack.
// - 2026-05-21: เพิ่ม checkHealth สำหรับตรวจสอบสุขภาพและความเร็ว (Latency) ของ Ollama
// - 2026-06-02: เพิ่ม loadModel() preloading, ดึงจริงจาก /api/ps และเพิ่ม unloadModel() เพื่อล้างหน่วยความจำ GPU/VRAM (ADR-033, Suggestion 1)
// - 2026-06-03: ADR-034 — เปลี่ยน default model เป็น np-dms-ai; เพิ่ม ocrModel field, keepAlive param ใน loadModel(), model option ใน OllamaGenerateOptions, getOcrModelName()
// - 2026-06-06: เพิ่ม system prompt support ใน OllamaGenerateOptions และ generate() method เพื่อรองรับ np-dms-ai model ที่ต้องการ system prompt แยกต่างหาก
// - 2026-06-06: [T036] แก้ไข default URL เป็น http://192.168.10.100:11434 (Desk-5439) แทน localhost; เพิ่ม options และ keepAlive ใน OllamaGenerateOptions เพื่อรองรับ np-dms-ai model parameters
// - 2026-06-08: เพิ่ม num_predict ใน OllamaGenerateOptions.options — ป้องกัน JSON truncation เมื่อ LLM สร้าง structured output
// - 2026-06-13: ADR-036 — เปลี่ยน default model tags เป็น np-dms-ai/np-dms-ocr
// - 2026-06-29: ADR-035 — embedModel default เปลี่ยนจาก nomic-embed-text เป็นค่าว่าง (embedding ย้ายไป BGE-M3 ใน OCR Sidecar แล้ว)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OllamaGenerateOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  /** ชื่อ model ที่ต้องการใช้ — ถ้าไม่ระบุ จะใช้ mainModel เป็นค่าเริ่มต้น (ADR-034) */
  model?: string;
  /** System prompt สำหรับ np-dms-ai model ที่ต้องการ system prompt แยกต่างหาก (ใช้ triple quotes) */
  system?: string;
  /** บังคับ structured output จาก Ollama สำหรับงานที่ต้อง parse JSON */
  format?: 'json';
  /** Ollama generation options (temperature, top_p, etc.) */
  options?: {
    temperature?: number;
    top_p?: number;
    repeat_penalty?: number;
    num_gpu?: number;
    num_ctx?: number;
    /** จำนวน tokens สูงสุดที่ LLM จะสร้าง — ป้องกัน JSON truncation */
    num_predict?: number;
  };
  /** keep_alive: -1 = stay loaded, 0 = unload immediately, N = seconds */
  keepAlive?: number;
}

/** บริการเรียก Ollama local-only บน Admin Desktop ตาม ADR-023A */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly mainModel: string;
  private readonly ocrModel: string;
  private readonly embedModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>(
        'AI_HOST_URL',
        'http://192.168.10.11:11434'
      )
    );
    this.mainModel = this.configService.get<string>(
      'OLLAMA_MODEL_MAIN',
      'np-dms-ai:latest'
    );
    this.ocrModel = this.configService.get<string>(
      'OLLAMA_MODEL_OCR',
      'np-dms-ocr:latest'
    );
    this.embedModel = this.configService.get<string>(
      'OLLAMA_MODEL_EMBED',
      this.configService.get<string>('OLLAMA_EMBED_MODEL', '')
    );
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 30000);
  }

  /** สร้างข้อความตอบกลับด้วย np-dms-ai:latest หรือโมเดลที่ระบุใน options.model / ENV */
  async generate(
    prompt: string,
    options: OllamaGenerateOptions = {}
  ): Promise<string> {
    try {
      const response = await axios.post<{ response: string }>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: options.model ?? this.mainModel,
          prompt,
          system: options.system,
          format: options.format,
          stream: false,
          options: options.options,
          keep_alive: options.keepAlive ?? -1,
        },
        {
          timeout: options.timeoutMs ?? this.timeoutMs,
          signal: options.signal,
        }
      );
      return response.data.response ?? '';
    } catch (err) {
      this.logger.error(
        'Ollama generate failed',
        err instanceof Error ? err.stack : String(err)
      );
      throw err;
    }
  }

  /** สร้าง embedding ด้วย Ollama embeddings API (ค่า ENV ที่กำหนด — ADR-035: BGE-M3 ใน Sidecar แทน) */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await axios.post<{ embedding: number[] }>(
        `${this.ollamaUrl}/api/embeddings`,
        { model: this.embedModel, prompt: text },
        { timeout: this.timeoutMs }
      );
      return response.data.embedding;
    } catch (err) {
      this.logger.error(
        'Ollama embedding failed',
        err instanceof Error ? err.stack : String(err)
      );
      throw err;
    }
  }

  /** คืนชื่อ main model สำหรับ audit log */
  getMainModelName(): string {
    return this.mainModel;
  }

  /** คืนชื่อ OCR model สำหรับ model switching ใน BullMQ processor (ADR-034) */
  getOcrModelName(): string {
    return this.ocrModel;
  }

  /** คืนชื่อ embedding model สำหรับ audit log */
  getEmbeddingModelName(): string {
    return this.embedModel;
  }

  /** ตรวจสอบสุขภาพและความเร็ว (Latency) ของระบบ Ollama */
  async checkHealth(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
    latencyMs: number;
    models: string[];
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      const latencyMs = Date.now() - startTime;
      let loadedModels: string[] = [];
      try {
        const psResponse = await axios.get<{
          models?: Array<{ name: string }>;
        }>(`${this.ollamaUrl}/api/ps`, { timeout: 3000 });
        if (psResponse.data?.models) {
          loadedModels = psResponse.data.models.map((m) => m.name);
        }
      } catch (psErr) {
        this.logger.warn(
          `Failed to fetch loaded models from /api/ps: ${psErr instanceof Error ? psErr.message : String(psErr)}`
        );
      }
      if (loadedModels.length === 0) {
        loadedModels = this.embedModel
          ? [this.mainModel, this.embedModel]
          : [this.mainModel];
      }
      return {
        status: 'HEALTHY',
        latencyMs,
        models: loadedModels,
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - startTime;
      const error = err instanceof Error ? err.message : String(err);
      const isTimeout =
        err instanceof Error &&
        (err.message.includes('timeout') ||
          err.message.includes('504') ||
          err.message.includes('code ECONNABORTED'));
      return {
        status: isTimeout ? 'DEGRADED' : 'DOWN',
        latencyMs,
        models: this.embedModel
          ? [this.mainModel, this.embedModel]
          : [this.mainModel],
        error,
      };
    }
  }

  /** โหลดโมเดลเข้า VRAM — ใช้สำหรับ preload และ model switching (ADR-033, ADR-034)
   * @param keepAlive ค่า keep_alive: -1 = ค้างใน VRAM ตลอด (main), 0 = unload หลังจบ (OCR)
   */
  async loadModel(
    modelName: string,
    keepAlive?: number | string
  ): Promise<boolean> {
    try {
      const tagsResponse = await axios.get<{
        models?: Array<{ name: string; model: string }>;
      }>(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      const installedModels = tagsResponse.data?.models ?? [];
      const exists = installedModels.some(
        (m) =>
          m.name === modelName ||
          m.model === modelName ||
          m.name.startsWith(modelName)
      );
      if (!exists) {
        this.logger.warn(`Model ${modelName} is not installed in Ollama`);
        return false;
      }
      this.logger.log(
        `Synchronously pre-loading model ${modelName} into GPU memory (keep_alive=${String(keepAlive ?? -1)})...`
      );
      await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: modelName,
          prompt: '',
          stream: false,
          keep_alive: keepAlive ?? -1,
        },
        { timeout: 60000 }
      );
      this.logger.log(`Model ${modelName} pre-loaded successfully`);
      return true;
    } catch (err: unknown) {
      this.logger.error(
        `Failed to pre-load model ${modelName}`,
        err instanceof Error ? err.stack : String(err)
      );
      return false;
    }
  }
  /** ล้างโมเดลออกจากหน่วยความจำ GPU ของ Ollama เพื่อคืนค่า VRAM (ADR-033 Suggestion 1) */
  async unloadModel(modelName: string): Promise<boolean> {
    try {
      this.logger.log(`Unloading model ${modelName} from GPU memory...`);
      await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: modelName,
          prompt: '',
          stream: false,
          keep_alive: 0,
        },
        { timeout: 10000 }
      );
      this.logger.log(`Model ${modelName} unloaded successfully`);
      return true;
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to unload model ${modelName}: ${err instanceof Error ? err.message : String(err)}`
      );
      return false;
    }
  }
}
