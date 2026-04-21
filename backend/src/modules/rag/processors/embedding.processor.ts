import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from 'bullmq';
import { v4 as uuidv4 } from 'uuid';

import { EmbeddingService } from '../embedding.service';
import { QdrantService, VectorMetadata } from '../qdrant.service';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { EmbeddingJobData } from './thai-preprocess.processor';

const CHUNK_SIZE = 512;
const CHUNK_OVERLAP = 50;

@Processor('rag-embedding')
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly qdrantService: QdrantService,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepo: Repository<DocumentChunk>
  ) {
    super();
  }

  async process(job: Job<EmbeddingJobData>): Promise<void> {
    const {
      attachmentPublicId,
      normalizedText,
      docType,
      docNumber,
      revision,
      projectCode,
      projectPublicId,
      classification,
    } = job.data;

    const chunks = this.chunkText(normalizedText);
    const model = this.embeddingService.getModelName();

    const upsertPoints: Parameters<QdrantService['upsertBatch']>[0] = [];
    const chunkEntities: DocumentChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkId = uuidv4();
      const vector = await this.embeddingService.embed(chunks[i]);

      const payload: VectorMetadata = {
        chunk_id: chunkId,
        public_id: attachmentPublicId,
        project_public_id: projectPublicId,
        doc_type: docType,
        doc_number: docNumber,
        revision,
        project_code: projectCode,
        classification,
        content_preview: chunks[i].slice(0, 500),
        embedding_model: model,
      };

      upsertPoints.push({ id: chunkId, vector, payload });

      const entity = this.chunkRepo.create({
        id: chunkId,
        documentId: attachmentPublicId,
        chunkIndex: i,
        content: chunks[i],
        docType,
        docNumber,
        revision,
        projectCode,
        projectPublicId,
        classification,
        embeddingModel: model,
      });
      chunkEntities.push(entity);
    }

    if (upsertPoints.length > 0) {
      await this.qdrantService.upsertBatch(upsertPoints);
      await this.chunkRepo.save(chunkEntities);
    }

    await this.chunkRepo.manager.query(
      `UPDATE attachments SET rag_status = 'INDEXED', rag_last_error = NULL WHERE public_id = ?`,
      [attachmentPublicId]
    );

    this.logger.log(
      `Embedded ${chunks.length} chunks for ${attachmentPublicId}`
    );
  }

  private chunkText(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + CHUNK_SIZE, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start += CHUNK_SIZE - CHUNK_OVERLAP;
    }

    return chunks.filter((c) => c.trim().length > 0);
  }
}
