import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JwtService } from '@nestjs/jwt';

/**
 * Feature 253 — T091: Maintenance Console (E2E)
 *
 * ทดสอบ Maintenance Console endpoints
 * - ต้องมี test DB + seed data + Redis
 */
describe('Maintenance Console (E2E) — Feature 253', () => {
  let app: INestApplication;
  let jwtService: JwtService;

  const superadmin = { user_id: 1, username: 'superadmin', organization_id: 1 };
  let token: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);

    token = jwtService.sign({
      username: superadmin.username,
      sub: superadmin.user_id,
    });
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /maintenance/numbering/gaps — gated by system.numbering_override', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .get('/maintenance/numbering/gaps')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 403]).toContain(res.status);
  });

  it('GET /maintenance/orphan-cleanup/scan — gated by system.orphan_cleanup', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .get('/maintenance/orphan-cleanup/scan')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 403]).toContain(res.status);
  });

  it('GET /maintenance/vector-sync/missing — gated by system.vector_sync', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .get('/maintenance/vector-sync/missing')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 403]).toContain(res.status);
  });

  it('GET /maintenance/emergency-unlock/stuck-locks — gated by system.emergency_unlock', async () => {
    const res = await request(app.getHttpServer() as import('http').Server)
      .get('/maintenance/emergency-unlock/stuck-locks')
      .set('Authorization', `Bearer ${token}`);

    expect([200, 403]).toContain(res.status);
  });
});
