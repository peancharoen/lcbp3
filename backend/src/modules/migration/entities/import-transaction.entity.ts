import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('import_transactions')
export class ImportTransaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('idx_idem_key', { unique: true })
  @Column({ name: 'idempotency_key', length: 255, unique: true })
  idempotencyKey!: string;

  @Column({ name: 'document_number', length: 100, nullable: true })
  documentNumber!: string;

  @Column({ name: 'batch_id', length: 100, nullable: true })
  batchId!: string;

  @Column({ name: 'status_code', default: 201 })
  statusCode!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
