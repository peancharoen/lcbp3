// File: src/modules/rag/local-llm.service.ts
// Change Log
// - 2026-05-15: แทนที่ cloud LLM API ด้วย Ollama local-only ตาม ADR-023A.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface LlmGenerateResult {
  answer: string;
  usedFallbackModel: boolean;
}

/** บริการเรียก LLM ภายในองค์กรผ่าน Ollama เท่านั้น */
@Injectable()
export class LocalLlmService {
  private readonly logger = new Logger(LocalLlmService.name);
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      this.configService.get<string>('AI_HOST_URL', 'http://localhost:11434')
    );
    this.ollamaModel = this.configService.get<string>(
      'OLLAMA_MODEL_MAIN',
      this.configService.get<string>('OLLAMA_RAG_MODEL', 'gemma4:e4b')
    );
    this.timeoutMs = this.configService.get<number>('RAG_TIMEOUT_MS', 30000);
  }

  /** สร้างคำตอบจากโมเดล local-only โดยไม่มี cloud fallback */
  async generate(prompt: string): Promise<LlmGenerateResult> {
    try {
      const response = await axios.post<{ response: string }>(
        `${this.ollamaUrl}/api/generate`,
        {
          model: this.ollamaModel,
          prompt,
          stream: false,
        },
        { timeout: this.timeoutMs }
      );
      return {
        answer: response.data.response ?? '',
        usedFallbackModel: false,
      };
    } catch (err) {
      this.logger.error(
        'Local Ollama generation failed',
        err instanceof Error ? err.stack : String(err)
      );
      throw err;
    }
  }

  /** ทำความสะอาด prompt injection pattern พื้นฐานก่อนส่งเข้าโมเดล */
  sanitizeInput(text: string): string {
    return text
      .replace(/<CONTEXT_START>|<CONTEXT_END>/gi, '')
      .replace(/ignore previous instructions/gi, '')
      .replace(/system:/gi, '')
      .slice(0, 1000);
  }
}
