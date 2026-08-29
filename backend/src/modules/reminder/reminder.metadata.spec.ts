// File: backend/src/modules/reminder/reminder.metadata.spec.ts
// Change Log:
// - 2026-06-20: เพิ่ม tests สำหรับ cover decorator metadata Object-fallback branch

jest.mock('@nestjs/typeorm', () => {
  const actual =
    jest.requireActual<typeof import('@nestjs/typeorm')>('@nestjs/typeorm');
  return {
    ...actual,
    InjectRepository: () => () => undefined,
  };
});

jest.mock('typeorm', () => {
  const actual = jest.requireActual<typeof import('typeorm')>('typeorm');
  return {
    ...actual,
    Repository: {
      _mockedNonFunction: true,
    } as unknown as typeof import('typeorm').Repository,
  };
});

import { ReminderService } from './reminder.service';

describe('ReminderService — decorator metadata fallback', () => {
  it('should instantiate when typeorm Repository is not a function', () => {
    const service = new ReminderService(
      {} as never,
      {} as never,
      {} as never,
      {} as never
    );
    expect(service).toBeDefined();
  });
});
