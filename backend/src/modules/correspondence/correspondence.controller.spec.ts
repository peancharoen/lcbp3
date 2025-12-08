import { Test, TestingModule } from '@nestjs/testing';
import { CorrespondenceController } from './correspondence.controller';
import { CorrespondenceService } from './correspondence.service';

describe('CorrespondenceController', () => {
  let controller: CorrespondenceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CorrespondenceController],
      providers: [
        {
          provide: CorrespondenceService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            submit: jest.fn(),
            processAction: jest.fn(),
            getReferences: jest.fn(),
            addReference: jest.fn(),
            removeReference: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CorrespondenceController>(CorrespondenceController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
