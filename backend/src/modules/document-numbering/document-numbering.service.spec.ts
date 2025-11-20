import { Test, TestingModule } from '@nestjs/testing';
import { DocumentNumberingService } from './document-numbering.service';

describe('DocumentNumberingService', () => {
  let service: DocumentNumberingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentNumberingService],
    }).compile();

    service = module.get<DocumentNumberingService>(DocumentNumberingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
