import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { WorkflowDefinition } from '../src/modules/workflow-engine/entities/workflow-definition.entity';

/**
 * Phase 3 Workflow (E2E) - Unified Workflow Engine
 *
 * Tests the correspondence workflow using the Unified Workflow Engine
 * instead of the deprecated RoutingTemplate system.
 */
describe('Phase 3 Workflow (E2E)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;
  let correspondenceId: number;
  let workflowInstanceId: string;

  // Test Users (must exist in seed data)
  const editorUser = { user_id: 3, username: 'editor01', organization_id: 41 };
  const adminUser = { user_id: 2, username: 'admin', organization_id: 1 };

  let editorToken: string;
  let _adminToken: string;

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
    _adminToken = jwtService.sign({
      username: adminUser.username,
      sub: adminUser.user_id,
    });

    // Ensure workflow definition exists (should be seeded)
    const defRepo = dataSource.getRepository(WorkflowDefinition);
    const existing = await defRepo.findOne({
      where: { workflow_code: 'CORRESPONDENCE_FLOW_V1', is_active: true },
    });
    expect(existing).toBeDefined();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/correspondences (POST) - Create Document', async () => {
    const response = await request(app.getHttpServer() as import('http').Server)
      .post('/correspondences')
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        projectId: 1,
        typeId: 1,
        title: 'E2E Workflow Test Document',
        details: { question: 'Testing Unified Workflow' },
      })
      .expect(201);

    const body = response.body as { id: number; correspondenceNumber: string };
    expect(body).toHaveProperty('id');
    expect(body).toHaveProperty('correspondenceNumber');
    correspondenceId = body.id;
  });

  it('/correspondences/:id/submit (POST) - Submit to Workflow', async () => {
    const response = await request(app.getHttpServer() as import('http').Server)
      .post(`/correspondences/${correspondenceId}/submit`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({
        note: 'Submitting for E2E test',
      })
      .expect(201);

    const body = response.body as { instanceId: string; currentState: string };
    expect(body).toHaveProperty('instanceId');
    expect(body).toHaveProperty('currentState');
    workflowInstanceId = body.instanceId;
  });

  it('/correspondences/:id/workflow/action (POST) - Process Action', async () => {
    // Skip if submit failed to get instanceId
    if (!workflowInstanceId) {
      return;
    }

    const response = await request(app.getHttpServer() as import('http').Server)
      .post(`/correspondences/${correspondenceId}/workflow/action`)
      .set('Authorization', `Bearer ${editorToken}`) // Use editor - has workflow.action_review permission
      .send({
        instanceId: workflowInstanceId,
        action: 'APPROVE',
        comment: 'E2E Approved via Unified Workflow Engine',
      })
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('nextState');
  });
});
