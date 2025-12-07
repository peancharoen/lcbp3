import { Test, TestingModule } from '@nestjs/testing';
import { JsonSchemaController } from './json-schema.controller';
import { JsonSchemaService } from './json-schema.service';
import { SchemaMigrationService } from './services/schema-migration.service';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

describe('JsonSchemaController', () => {
  let controller: JsonSchemaController;

  const mockJsonSchemaService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findLatestByCode: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    validateData: jest.fn(),
    processReadData: jest.fn(),
  };

  const mockSchemaMigrationService = {
    migrateData: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JsonSchemaController],
      providers: [
        {
          provide: JsonSchemaService,
          useValue: mockJsonSchemaService,
        },
        {
          provide: SchemaMigrationService,
          useValue: mockSchemaMigrationService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard) // Override Guards to avoid dependency issues in Unit Test
      .useValue({ canActivate: () => true })
      .overrideGuard(RbacGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<JsonSchemaController>(JsonSchemaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
