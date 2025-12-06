import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('document_number_audit')
@Index(['generatedAt'])
@Index(['userId'])
export class DocumentNumberAudit {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'generated_number', length: 100 })
  generatedNumber!: string;

  @Column({ name: 'counter_key', length: 255 })
  counterKey!: string;

  @Column({ name: 'template_used', type: 'text' })
  templateUsed!: string;

  @Column({ name: 'sequence_number' })
  sequenceNumber!: number;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'lock_wait_ms', nullable: true })
  lockWaitMs?: number;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt!: Date;
}
