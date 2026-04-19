import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Job } from 'bullmq';
import axios from 'axios';

import { OcrJobData } from './ocr.processor';

export interface ThaiPreprocessJobData extends OcrJobData {
  rawText: string;
}

export interface EmbeddingJobData extends ThaiPreprocessJobData {
  normalizedText: string;
}

@Processor('rag:thai-preprocess')
export class ThaiPreprocessProcessor extends WorkerHost {
  private readonly logger = new Logger(ThaiPreprocessProcessor.name);
  private readonly thaiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue('rag:embedding') private readonly embeddingQueue: Queue
  ) {
    super();
    this.thaiUrl = this.configService.get<string>(
      'THAI_PREPROCESS_URL',
      'http://localhost:8765'
    );
  }

  async process(job: Job<ThaiPreprocessJobData>): Promise<void> {
    const { rawText, attachmentPublicId } = job.data;

    let normalizedText = rawText;
    try {
      const response = await axios.post<{ normalized: string }>(
        `${this.thaiUrl}/normalize`,
        { text: rawText },
        { timeout: 30000 }
      );
      normalizedText = response.data.normalized ?? rawText;
    } catch (err) {
      this.logger.warn(
        `Thai preprocess failed for ${attachmentPublicId}, using raw text: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    await this.embeddingQueue.add(
      'embed',
      { ...job.data, normalizedText } as EmbeddingJobData,
      { jobId: `embed:${attachmentPublicId}` }
    );
  }
}
