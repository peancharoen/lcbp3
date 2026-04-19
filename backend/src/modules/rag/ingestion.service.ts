import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { OcrJobData } from './processors/ocr.processor';

@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(@InjectQueue('rag:ocr') private readonly ocrQueue: Queue) {}

  async enqueue(data: OcrJobData): Promise<void> {
    const jobId = data.attachmentPublicId;

    const existing = await this.ocrQueue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'active' || state === 'waiting' || state === 'delayed') {
        this.logger.log(
          `rag:ocr job already queued for ${jobId} (state: ${state})`
        );
        return;
      }
    }

    await this.ocrQueue.add('ocr', data, { jobId });
    this.logger.log(`Enqueued rag:ocr for attachment ${jobId}`);
  }
}
