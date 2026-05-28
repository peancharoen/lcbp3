// File: backend/src/modules/ai/prompts/dto/ai-prompt-response.dto.ts
// Change Log
// - 2026-05-25: Created AiPromptResponseDto to exclude internal INT PK and expose clean API fields (ADR-029)
// - 2026-05-25: Added definite assignment assertion operator (!) to satisfy strictPropertyInitialization
// - 2026-05-27: Added publicId field for ADR-019 compliance

import { Expose } from 'class-transformer';

/**
 * Data Transfer Object สำหรับส่งออกข้อมูล Prompt version ทาง API
 * โดยคัดกรองเฉพาะข้อมูลภายนอกและปิดบัง PK ดั้งเดิมตามนโยบายความปลอดภัย
 */
export class AiPromptResponseDto {
  @Expose({ name: 'id' })
  publicId!: string;

  @Expose()
  promptType!: string;

  @Expose()
  versionNumber!: number;

  @Expose()
  template!: string;

  @Expose()
  isActive!: boolean;

  @Expose()
  testResultJson!: Record<string, unknown> | null;

  @Expose()
  contextConfig!: Record<string, unknown> | null;

  @Expose()
  manualNote!: string | null;

  @Expose()
  lastTestedAt!: Date | null;

  @Expose()
  activatedAt!: Date | null;

  @Expose()
  createdAt!: Date;
}
