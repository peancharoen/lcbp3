import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { RoutingTemplate } from '../src/modules/correspondence/entities/routing-template.entity';
import { RoutingTemplateStep } from '../src/modules/correspondence/entities/routing-template-step.entity';

describe('Phase 3 Workflow (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let templateId: number;
  let correspondenceId: number;

  // Users
  const editorUser = { user_id: 3, username: 'editor01', organization_id: 41 }; // Editor01 (Org 41)
  const adminUser = { user_id: 2, username: 'admin', organization_id: 1 }; // Admin (Org 1)

  let editorToken: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Generate Tokens
    editorToken = jwtService.sign({
      username: editorUser.username,
      sub: editorUser.user_id,
    });
    adminToken = jwtService.sign({
      username: adminUser.username,
      sub: adminUser.user_id,
    });

    // Seed Template
    const templateRepo = dataSource.getRepository(RoutingTemplate);
    const stepRepo = dataSource.getRepository(RoutingTemplateStep);

    const template = templateRepo.create({
      templateName: 'E2E Test Template',
      isActive: true,
    });
    const savedTemplate = await templateRepo.save(template);
    templateId = savedTemplate.id;

    const step = stepRepo.create({
      templateId: savedTemplate.id,
      sequence: 1,
      toOrganizationId: adminUser.organization_id, // Send to Admin's Org
      stepPurpose: 'FOR_APPROVAL',
    });
    await stepRepo.save(step);
  });

  afterAll(async () => {
    // Cleanup
    if (dataSource) {
      const templateRepo = dataSource.getRepository(RoutingTemplate);
      await templateRepo.delete(templateId);
      // Correspondence cleanup might be needed if not using a test DB
    }
    await app.close();
  });

  it('/correspondences (POST) - Create Document', async () => {
    const response = await request(app.getHttpServer())
      .post('/correspondences')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        projectId: 1, // LCBP3
        typeId: 1, // RFA (Assuming ID 1 exists from seed)
        title: 'E2E Workflow Test Document',
        details: { question: 'Testing Workflow' },
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body).toHaveProperty('correspondenceNumber');
    correspondenceId = response.body.id;
    console.log('Created Correspondence ID:', correspondenceId);
  });

  it('/correspondences/:id/submit (POST) - Submit Workflow', async () => {
    await request(app.getHttpServer())
      .post(`/correspondences/${correspondenceId}/submit`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        templateId: templateId,
      })
      .expect(201);
  });

  it('/correspondences/:id/workflow/action (POST) - Approve Step', async () => {
    await request(app.getHttpServer())
      .post(`/correspondences/${correspondenceId}/workflow/action`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'APPROVE',
        comment: 'E2E Approved',
      })
      .expect(201);
  });
});
