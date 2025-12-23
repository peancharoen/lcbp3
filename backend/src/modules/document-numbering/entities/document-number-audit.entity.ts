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
@Index(['documentId'])
@Index(['status'])
@Index(['operation'])
@Index(['generatedNumber'])
@Index(['reservationToken'])
export class DocumentNumberAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'document_id', nullable: true })
  documentId?: number;

  @Column({ name: 'generated_number', length: 100 })
  generatedNumber!: string;

  @Column({ name: 'counter_key', type: 'json' })
  counterKey!: any;

  @Column({ name: 'template_used', length: 200 })
  templateUsed!: string;

  @Column({
    name: 'operation',
    type: 'enum',
    enum: [
      'RESERVE',
      'CONFIRM',
      'CANCEL',
      'MANUAL_OVERRIDE',
      'VOID',
      'GENERATE',
    ],
    default: 'CONFIRM',
  })
  operation!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ['RESERVED', 'CONFIRMED', 'CANCELLED', 'VOID', 'MANUAL'],
    nullable: true,
  })
  status?: string;

  @Column({ name: 'reservation_token', length: 36, nullable: true })
  reservationToken?: string;

  @Column({ name: 'idempotency_key', length: 36, nullable: true })
  idempotencyKey?: string;

  @Column({ name: 'originator_organization_id', nullable: true })
  originatorOrganizationId?: number;

  @Column({ name: 'recipient_organization_id', nullable: true })
  recipientOrganizationId?: number;

  @Column({ name: 'old_value', type: 'text', nullable: true })
  oldValue?: string;

  @Column({ name: 'new_value', type: 'text', nullable: true })
  newValue?: string;

  @Column({ name: 'metadata', type: 'json', nullable: true })
  metadata?: any;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'is_success', default: true })
  isSuccess!: boolean;

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
