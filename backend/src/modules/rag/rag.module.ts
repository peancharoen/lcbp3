import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { DocumentChunk } from './entities/document-chunk.entity';
import { EmbeddingService } from './embedding.service';
import { QdrantService } from './qdrant.service';
import { TyphoonService } from './typhoon.service';
import { RagService } from './rag.service';
import { RagController } from './rag.controller';
import { IngestionService } from './ingestion.service';
import { OcrProcessor } from './processors/ocr.processor';
import { ThaiPreprocessProcessor } from './processors/thai-preprocess.processor';
import { EmbeddingProcessor } from './processors/embedding.processor';
import { UserModule } from '../user/user.module';

const DLQ_DEFAULTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

@Module({
  imports: [
    ConfigModule,
    UserModule,
    TypeOrmModule.forFeature([DocumentChunk]),
    BullModule.registerQueue(
      { name: 'rag:ocr', defaultJobOptions: DLQ_DEFAULTS },
      { name: 'rag:thai-preprocess', defaultJobOptions: DLQ_DEFAULTS },
      { name: 'rag:embedding', defaultJobOptions: DLQ_DEFAULTS }
    ),
  ],
  controllers: [RagController],
  providers: [
    EmbeddingService,
    QdrantService,
    TyphoonService,
    RagService,
    IngestionService,
    OcrProcessor,
    ThaiPreprocessProcessor,
    EmbeddingProcessor,
  ],
  exports: [
    EmbeddingService,
    QdrantService,
    TyphoonService,
    RagService,
    IngestionService,
  ],
})
export class RagModule {}
