// File: src/modules/ai/services/ollama.service.ts
// Change Log
// - 2026-05-15: เพิ่ม Ollama service สำหรับ ADR-023A 2-model stack.
// - 2026-05-21: เพิ่ม checkHealth สำหรับตรวจสอบสุขภาพและความเร็ว (Latency) ของ Ollama
// - 2026-05-25: เพิ่มการใช้งานโมเดลจาก DB (AiSettingsService) แทน ENV เท่านั้น (ADR-027).

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AiSettingsService } from '../ai-settings.service';

export interface OllamaGenerateOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** บริการเรียก Ollama local-only บน Admin Desktop ตาม ADR-023A */
@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly ollamaUrl: string;
  private readonly defaultMainModel: string;
  private readonly embedModel: string;
  private readonly timeoutMs: number;

  constructor(
    private readonly configService: ConfigService,
    @Optional()
    private readonly aiSettingsService?: AiSettingsService
  ) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>('AI_HOST_URL', 'http://localhost:11434')
    );
    // Default fallback model (ADR-023A: gemma4:e2b)
    this.defaultMainModel = this.configService.get<string>(
      'OLLAMA_MODEL_MAIN',
      'gemma4:e2b'
    );
    this.embedModel = this.configService.get<string>(
      'OLLAMA_MODEL_EMBED',
      this.configService.get<string>('OLLAMA_EMBED_MODEL', 'nomic-embed-text')
    );
    this.timeoutMs = this.configService.get<number>('AI_TIMEOUT_MS', 30000);
  }

  /** ดึงชื่อโมเดลที่ใช้งานอยู่ (จาก DB หรือ ENV fallback) */
  private async getActiveModelName(): Promise<string> {
    if (this.aiSettingsService) {
      try {
        return await this.aiSettingsService.getActiveModel();
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to get active model from DB: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    return this.defaultMainModel;
  }

  /** สร้างข้อความตอบกลับจากโมเดลที่กำหนด (DB หรือ ENV fallback) */
  async generate(
    prompt: string,
    options: OllamaGenerateOptions = {}
  ): Promise<string> {
    const modelName = await this.getActiveModelName();
    try {
      const response = await axios.post<{ response: string }>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: modelName,
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
        `Ollama generate failed with model ${modelName}`,
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

  /** คืนชื่อ main model สำหรับ audit log (async เพราะต้องเช็ค DB) */
  async getMainModelName(): Promise<string> {
    return this.getActiveModelName();
  }

  /** คืนชื่อ main model แบบ sync (fallback สำหรับกรณีที่ไม่ต้องการ async) */
  getMainModelNameSync(): string {
    return this.defaultMainModel;
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
    const activeModel = await this.getActiveModelName();
    try {
      await axios.get(`${this.ollamaUrl}/api/tags`, { timeout: 5000 });
      const latencyMs = Date.now() - startTime;
      return {
        status: 'HEALTHY',
        latencyMs,
        models: [activeModel, this.embedModel],
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
        models: [activeModel, this.embedModel],
        error,
      };
    }
  }
}
