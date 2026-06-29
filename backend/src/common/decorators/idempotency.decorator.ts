// File: src/common/decorators/idempotency.decorator.ts
// ใช้สำหรับบังคับว่า Controller นี้ต้องมี Idempotency Key (Optional Enhancement)

import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_KEY = 'idempotency_required';
export const RequireIdempotency = () => SetMetadata(IDEMPOTENCY_KEY, true);
