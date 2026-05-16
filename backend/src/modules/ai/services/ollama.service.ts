// File: src/modules/ai/services/ollama.service.ts
// Change Log
// - 2026-05-15: เพิ่ม Ollama service สำหรับ ADR-023A 2-model stack.

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
}
