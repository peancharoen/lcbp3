// File: src/modules/rfa/entities/rfa-revision.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { RfaApproveCode } from './rfa-approve-code.entity';
import { RfaItem } from './rfa-item.entity';
import { RfaStatusCode } from './rfa-status-code.entity';
import { RfaWorkflow } from './rfa-workflow.entity';
import { Rfa } from './rfa.entity';

@Entity('rfa_revisions')
@Unique(['rfaId', 'revisionNumber'])
@Unique(['rfaId', 'isCurrent'])
export class RfaRevision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'rfa_id' })
  rfaId!: number;

  @Column({ name: 'revision_number' })
  revisionNumber!: number;

  @Column({ name: 'revision_label', length: 10, nullable: true })
  revisionLabel?: string;

  @Column({ name: 'is_current', default: false })
  isCurrent!: boolean;

  @Column({ name: 'rfa_status_code_id' })
  rfaStatusCodeId!: number;

  @Column({ name: 'rfa_approve_code_id', nullable: true })
  rfaApproveCodeId?: number;

  @Column({ length: 500 })
  subject!: string;

  @Column({ name: 'document_date', type: 'date', nullable: true })
  documentDate?: Date;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate?: Date;

  @Column({ name: 'received_date', type: 'datetime', nullable: true })
  receivedDate?: Date;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate?: Date;

  @Column({ name: 'approved_date', type: 'date', nullable: true })
  approvedDate?: Date;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  // --- JSON & Schema Section ---

  @Column({ type: 'json', nullable: true })
  details?: any;

  // ✅ [New] จำเป็นสำหรับ Data Migration (T2.5.5)
  @Column({ name: 'schema_version', default: 1 })
  schemaVersion!: number;

  // ✅ Virtual Column
  @Column({
    name: 'v_ref_drawing_count',
    type: 'int',
    generatedType: 'VIRTUAL',
    asExpression: "JSON_UNQUOTE(JSON_EXTRACT(details, '$.drawingCount'))",
    nullable: true,
  })
  vRefDrawingCount?: number;

  // --- Timestamp ---

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  // --- Relations ---

  @ManyToOne(() => Rfa)
  @JoinColumn({ name: 'rfa_id' })
  rfa!: Rfa;

  @ManyToOne(() => RfaStatusCode)
  @JoinColumn({ name: 'rfa_status_code_id' })
  statusCode!: RfaStatusCode;

  @ManyToOne(() => RfaApproveCode)
  @JoinColumn({ name: 'rfa_approve_code_id' })
  approveCode?: RfaApproveCode;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;

  @OneToMany(() => RfaItem, (item) => item.rfaRevision, { cascade: true })
  items!: RfaItem[];

  @OneToMany(() => RfaWorkflow, (workflow) => workflow.rfaRevision, {
    cascade: true,
  })
  workflows!: RfaWorkflow[];
}
