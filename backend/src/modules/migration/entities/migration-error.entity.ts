import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

export enum MigrationErrorType {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  AI_PARSE_ERROR = 'AI_PARSE_ERROR',
  API_ERROR = 'API_ERROR',
  DB_ERROR = 'DB_ERROR',
  SECURITY = 'SECURITY',
  UNKNOWN = 'UNKNOWN',
}

@Entity('migration_errors')
export class MigrationError {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'batch_id', length: 50, nullable: true })
  batchId?: string;

  @Column({ name: 'document_number', length: 100, nullable: true })
  documentNumber?: string;

  @Column({
    name: 'error_type',
    type: 'enum',
    enum: MigrationErrorType,
    nullable: true,
  })
  errorType?: MigrationErrorType;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'raw_ai_response', type: 'text', nullable: true })
  rawAiResponse?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
