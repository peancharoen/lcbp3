import { Test, TestingModule } from '@nestjs/testing';
import { CorrespondenceController } from './correspondence.controller';

describe('CorrespondenceController', () => {
  let controller: CorrespondenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrespondenceController],
    }).compile();

    controller = module.get<CorrespondenceController>(CorrespondenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
