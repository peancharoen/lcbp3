import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly ollamaUrl: string;
  private readonly model: string;

  constructor(private readonly configService: ConfigService) {
    this.ollamaUrl = this.configService.get<string>(
      'OLLAMA_URL',
      'http://localhost:11434'
    );
    this.model = this.configService.get<string>(
      'OLLAMA_EMBED_MODEL',
      'nomic-embed-text'
    );
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await axios.post<{ embedding: number[] }>(
        `${this.ollamaUrl}/api/embeddings`,
        { model: this.model, prompt: text },
        { timeout: 30000 }
      );
      return response.data.embedding;
    } catch (err) {
      this.logger.error(
        'Embedding failed',
        err instanceof Error ? err.stack : String(err)
      );
      throw err;
    }
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.embed(t)));
  }

  getModelName(): string {
    return this.model;
  }
}
