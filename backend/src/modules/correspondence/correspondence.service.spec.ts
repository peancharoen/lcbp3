import { Test, TestingModule } from '@nestjs/testing';
import { CorrespondenceService } from './correspondence.service';

describe('CorrespondenceService', () => {
  let service: CorrespondenceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CorrespondenceService],
    }).compile();

    service = module.get<CorrespondenceService>(CorrespondenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
