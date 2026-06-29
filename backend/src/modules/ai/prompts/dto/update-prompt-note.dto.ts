// File: backend/src/modules/ai/prompts/dto/update-prompt-note.dto.ts
// Change Log
// - 2026-05-25: Created UpdatePromptNoteDto for annotation updates (ADR-029)
// - 2026-05-25: Added definite assignment assertion operator (!) to satisfy strictPropertyInitialization

import { IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object สำหรับอัปเดต manual note ของ prompt version
 */
export class UpdatePromptNoteDto {
  @IsString()
  @IsOptional()
  manualNote!: string | null;
}
