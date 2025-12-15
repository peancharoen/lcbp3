import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('document_number_audit')
@Index(['createdAt'])
@Index(['userId'])
export class DocumentNumberAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'document_id' })
  documentId!: number;

  @Column({ name: 'generated_number', length: 100 })
  generatedNumber!: string;

  @Column({ name: 'counter_key', type: 'json' })
  counterKey!: any;

  @Column({ name: 'template_used', length: 200 })
  templateUsed!: string;

  @Column({
    name: 'operation',
    type: 'enum',
    enum: ['RESERVE', 'CONFIRM', 'MANUAL_OVERRIDE', 'VOID_REPLACE', 'CANCEL'],
    default: 'CONFIRM',
  })
  operation!: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: any;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'lock_wait_ms', nullable: true })
  lockWaitMs?: number;

  @Column({ name: 'total_duration_ms', nullable: true })
  totalDurationMs?: number;

  @Column({
    name: 'fallback_used',
    type: 'enum',
    enum: ['NONE', 'DB_LOCK', 'RETRY'],
    default: 'NONE',
  })
  fallbackUsed?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
