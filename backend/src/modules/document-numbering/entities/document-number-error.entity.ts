import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('document_number_errors')
@Index(['errorAt'])
@Index(['userId'])
export class DocumentNumberError {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'counter_key', length: 255 })
  counterKey!: string;

  @Column({ name: 'error_type', length: 50 })
  errorType!: string;

  @Column({ name: 'error_message', type: 'text' })
  errorMessage!: string;

  @Column({ name: 'stack_trace', type: 'text', nullable: true })
  stackTrace?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: number;

  @Column({ name: 'ip_address', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'context', type: 'json', nullable: true })
  context?: any;

  @CreateDateColumn({ name: 'error_at' })
  errorAt!: Date;
}
