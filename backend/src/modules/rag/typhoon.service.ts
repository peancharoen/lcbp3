import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface LlmGenerateResult {
  answer: string;
  usedFallbackModel: boolean;
}

interface TyphoonChatResponse {
  choices: Array<{ message: { content: string } }>;
}

@Injectable()
export class TyphoonService {
  private readonly logger = new Logger(TyphoonService.name);
  private readonly typhoonUrl: string;
  private readonly typhoonKey: string;
  private readonly ollamaUrl: string;
  private readonly ollamaModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.typhoonUrl = this.configService.get<string>(
      'TYPHOON_API_URL',
      'https://api.opentyphoon.ai/v1'
    );
    this.typhoonKey = this.configService.get<string>('TYPHOON_API_KEY', '');
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434'
    );
    this.ollamaModel = this.configService.get<string>(
      'OLLAMA_RAG_MODEL',
      'gemma3:12b'
    );
    this.timeoutMs = this.configService.get<number>('RAG_TIMEOUT_MS', 5000);
  }

  async generate(
    prompt: string,
    forceLocal: boolean
  ): Promise<LlmGenerateResult> {
    if (forceLocal) {
      const answer = await this.generateOllama(prompt);
      return { answer, usedFallbackModel: true };
    }

    try {
      const answer = await Promise.race([
        this.generateTyphoon(prompt),
        this.delay(this.timeoutMs).then(() => {
          throw new Error('Typhoon timeout');
        }),
      ]);
      return { answer, usedFallbackModel: false };
    } catch (err) {
      this.logger.warn(
        `Typhoon failed, falling back to Ollama: ${err instanceof Error ? err.message : String(err)}`
      );
      const answer = await this.generateOllama(prompt);
      return { answer, usedFallbackModel: true };
    }
  }

  sanitizeInput(text: string): string {
    return text
      .replace(/<CONTEXT_START>|<CONTEXT_END>/gi, '')
      .replace(/ignore previous instructions/gi, '')
      .replace(/system:/gi, '')
      .slice(0, 1000);
  }

  private async generateTyphoon(prompt: string): Promise<string> {
    const response = await axios.post<TyphoonChatResponse>(
      `${this.typhoonUrl}/chat/completions`,
      {
        model: 'typhoon-v2.1-12b-instruct',
        messages: [
          {
            role: 'user',
            content: `<CONTEXT_START>\n${prompt}\n<CONTEXT_END>`,
          },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${this.typhoonKey}`,
          'Content-Type': 'application/json',
        },
        timeout: this.timeoutMs,
      }
    );
    return response.data.choices[0]?.message?.content ?? '';
  }

  private async generateOllama(prompt: string): Promise<string> {
    const response = await axios.post<{ response: string }>(
      `${this.ollamaUrl}/api/generate`,
      {
        model: this.ollamaModel,
        prompt,
        stream: false,
      },
      { timeout: 30000 }
    );
    return response.data.response ?? '';
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
