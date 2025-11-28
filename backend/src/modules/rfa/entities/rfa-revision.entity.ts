// File: src/modules/rfa/entities/rfa-revision.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Unique,
  Index,
} from 'typeorm';
import { Rfa } from './rfa.entity';
import { Correspondence } from '../../correspondence/entities/correspondence.entity';
import { RfaStatusCode } from './rfa-status-code.entity';
import { RfaApproveCode } from './rfa-approve-code.entity';
import { User } from '../../user/entities/user.entity';
import { RfaItem } from './rfa-item.entity';
import { RfaWorkflow } from './rfa-workflow.entity';

@Entity('rfa_revisions')
@Unique(['rfaId', 'revisionNumber'])
@Unique(['rfaId', 'isCurrent'])
export class RfaRevision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_id' })
  correspondenceId!: number;

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

  @Column({ length: 255 })
  title!: string;

  @Column({ name: 'document_date', type: 'date', nullable: true })
  documentDate?: Date;

  @Column({ name: 'issued_date', type: 'date', nullable: true })
  issuedDate?: Date;

  @Column({ name: 'received_date', type: 'datetime', nullable: true })
  receivedDate?: Date;

  @Column({ name: 'approved_date', type: 'date', nullable: true })
  approvedDate?: Date;

  @Column({ type: 'text', nullable: true })
  description?: string;

  // ✅ [New] เพิ่ม field details สำหรับเก็บข้อมูล Dynamic ของ RFA (เช่น Method Statement Details)
  @Column({ type: 'json', nullable: true })
  details?: any;

  // ✅ [New] Virtual Column: ดึงจำนวนแบบที่แนบ (drawingCount) จาก JSON
  @Column({
    name: 'v_ref_drawing_count',
    type: 'int',
    generatedType: 'VIRTUAL',
    asExpression: "JSON_UNQUOTE(JSON_EXTRACT(details, '$.drawingCount'))",
    nullable: true,
  })
  vRefDrawingCount?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  @Column({ name: 'updated_by', nullable: true })
  updatedBy?: number;

  // --- Relations ---

  @ManyToOne(() => Correspondence)
  @JoinColumn({ name: 'correspondence_id' })
  correspondence!: Correspondence;

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

  // Items (Shop Drawings inside this RFA)
  @OneToMany(() => RfaItem, (item) => item.rfaRevision, { cascade: true })
  items!: RfaItem[];

  // Workflows
  @OneToMany(() => RfaWorkflow, (workflow) => workflow.rfaRevision, {
    cascade: true,
  })
  workflows!: RfaWorkflow[];
}
