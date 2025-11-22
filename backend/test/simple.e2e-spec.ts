import request from 'supertest';
import { AppModule } from '../src/app.module';
import { RoutingTemplate } from '../src/modules/correspondence/entities/routing-template.entity';

import { Test, TestingModule } from '@nestjs/testing';

describe('Simple Test', () => {
  it('should pass', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    expect(moduleFixture).toBeDefined();
  });
});
