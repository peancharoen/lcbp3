import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('document_number_errors')
@Index(['createdAt'])
@Index(['userId'])
export class DocumentNumberError {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ name: 'context_data', type: 'json', nullable: true })
  context?: any;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
  resolvedAt?: Date;
}
