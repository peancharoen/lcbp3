import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentNumberingService } from './document-numbering.service.js';
import { DocumentNumberFormat } from './entities/document-number-format.entity.js';
import { DocumentNumberCounter } from './entities/document-number-counter.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentNumberFormat, DocumentNumberCounter]),
  ],
  providers: [DocumentNumberingService],
  exports: [DocumentNumberingService], // Export ให้คนอื่นเรียกใช้
})
export class DocumentNumberingModule {}
