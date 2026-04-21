import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { DocumentChunk } from '../entities/document-chunk.entity';

export interface OcrJobData {
  attachmentPublicId: string;
  filePath: string;
  docType: string;
  docNumber: string | null;
  revision: string | null;
  projectCode: string;
  projectPublicId: string;
  classification: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL';
}

@Processor('rag-ocr')
export class OcrProcessor extends WorkerHost {
  private readonly logger = new Logger(OcrProcessor.name);

  constructor(
    @InjectQueue('rag-thai-preprocess') private readonly thaiQueue: Queue,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>
  ) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    const { attachmentPublicId, filePath } = job.data;

    const existing = await this.chunkRepo.count({
      where: { documentId: attachmentPublicId },
    });
    if (existing > 0) {
      this.logger.log(
        `rag-ocr job already indexed for ${attachmentPublicId}, skipping`
      );
      return;
    }

    await this.chunkRepo.manager.query(
      `UPDATE attachments SET rag_status = 'PROCESSING' WHERE public_id = ?`,
      [attachmentPublicId]
    );

    let rawText: string;
    try {
      rawText = fs.readFileSync(filePath, 'utf-8');
    } catch {
      rawText = `[binary:${attachmentPublicId}]`;
    }

    await this.thaiQueue.add(
      'preprocess',
      { ...job.data, rawText },
      { jobId: `thai:${attachmentPublicId}` }
    );

    this.logger.log(`OCR enqueued thai-preprocess for ${attachmentPublicId}`);
  }
}
