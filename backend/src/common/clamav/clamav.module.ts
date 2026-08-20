// File: backend/src/common/clamav/clamav.module.ts
// Change Log:
// - 2026-08-20: Initial creation — ClamAV module for ADR-016 virus scanning (SEV-002)

import { Module, Global } from '@nestjs/common';
import { ClamAVService } from './clamav.service';

@Global()
@Module({
  providers: [ClamAVService],
  exports: [ClamAVService],
})
export class ClamAVModule {}
