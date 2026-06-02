// File: src/modules/ai/services/ollama.service.ts
// Change Log
// - 2026-05-15: เพิ่ม Ollama service สำหรับ ADR-023A 2-model stack.
// - 2026-05-21: เพิ่ม checkHealth สำหรับตรวจสอบสุขภาพและความเร็ว (Latency) ของ Ollama
// - 2026-06-02: เพิ่ม loadModel() preloading, ดึงจริงจาก /api/ps และเพิ่ม unloadModel() เพื่อล้างหน่วยความจำ GPU/VRAM (ADR-033, Suggestion 1)

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface OllamaGenerateOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** บริการเรียก Ollama local-only บน Admin Desktop ตาม ADR-023A */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly mainModel: string;
  private readonly embedModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>('AI_HOST_URL', 'http://localhost:11434')
    );
    this.mainModel = this.configService.get<string>(
      'OLLAMA_MODEL_MAIN',
      'gemma4:e4b'
    );
    this.embedModel = this.configService.get<string>(
      'OLLAMA_MODEL_EMBED',
      this.configService.get<string>('OLLAMA_EMBED_MODEL', 'nomic-embed-text')
    );
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 30000);
  }

  /** สร้างข้อความตอบกลับจาก gemma4:e4b หรือค่า ENV ที่กำหนด */
  async generate(
    prompt: string,
    options: OllamaGenerateOptions = {}
  ): Promise<string> {
    try {
      const response = await axios.post<{ response: string }>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.mainModel,
          prompt,
          stream: false,
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

  /** สร้าง embedding ด้วย nomic-embed-text หรือค่า ENV ที่กำหนด */
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
        loadedModels = [this.mainModel, this.embedModel];
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
        models: [this.mainModel, this.embedModel],
        error,
      };
    }
  }

  /** โหลดโมเดลล่วงหน้าแบบ Synchronous และตรวจสอบความพร้อมบน Ollama (T007) */
  async loadModel(modelName: string): Promise<boolean> {
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
        `Synchronously pre-loading model ${modelName} into GPU memory...`
      );
      await axios.post(
        `${this.ollamaUrl}/api/generate`,
        {
          model: modelName,
          prompt: '',
          stream: false,
          keep_alive: -1,
        },
        { timeout: 30000 }
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
