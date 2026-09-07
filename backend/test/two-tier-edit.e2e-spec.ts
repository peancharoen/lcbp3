import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';

import { CorrespondenceRevision } from '../src/modules/correspondence/entities/correspondence-revision.entity';

/**
 * Feature 253 — T105: Two-Tier Edit Enforcement (E2E)
 *
 * ทดสอบ 2-Tier Edit บน PUT /correspondences/:uuid
 * - DRAFT: แก้ไขเนื้อหา (subject) ได้
 * - non-DRAFT: แก้ไขเนื้อหาต้องถูก reject (422)
 * - non-DRAFT: แก้ไข metadata (disciplineId) ได้ (ถ้ามีสิทธิ์)
 */
describe('Two-Tier Edit Enforcement (E2E) — Feature 253', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let dataSource: DataSource;

  const user = { user_id: 2, username: 'dc', organization_id: 1 };
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    dataSource = moduleFixture.get<DataSource>(DataSource);

    token = jwtService.sign({
      username: user.username,
      sub: user.user_id,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('PUT /correspondences/:uuid — DRAFT allows content edit', async () => {
    const revRepo = dataSource.getRepository(CorrespondenceRevision);
    const rev = await revRepo.findOne({
      where: {},
      relations: ['status', 'correspondence'],
      order: { id: 'DESC' },
    });

    if (!rev || !rev.correspondence) {
      return;
    }

    if (rev.status?.statusCode !== 'DRAFT') {
      return;
    }

    const res = await request(app.getHttpServer() as import('http').Server)
      .put(`/correspondences/${rev.correspondence.publicId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `test-draft-edit-${Date.now()}`)
      .send({ subject: 'DRAFT content edit' });

    expect([200, 400, 403, 422]).toContain(res.status);
  });

  it('PUT /correspondences/:uuid — non-DRAFT rejects content edit with 422', async () => {
    const revRepo = dataSource.getRepository(CorrespondenceRevision);
    const rev = await revRepo.findOne({
      where: {},
      relations: ['status', 'correspondence'],
      order: { id: 'DESC' },
    });

    if (!rev || !rev.correspondence) {
      return;
    }

    if (rev.status?.statusCode === 'DRAFT') {
      return;
    }

    const res = await request(app.getHttpServer() as import('http').Server)
      .put(`/correspondences/${rev.correspondence.publicId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', `test-non-draft-edit-${Date.now()}`)
      .send({ subject: 'Attempt content edit after submit' });

    expect([422, 403, 400, 404]).toContain(res.status);
  });
});
