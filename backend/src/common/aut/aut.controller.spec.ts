import { Test, TestingModule } from '@nestjs/testing';
import { AutController } from './aut.controller';

describe('AutController', () => {
  let controller: AutController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AutController],
    }).compile();

    controller = module.get<AutController>(AutController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
