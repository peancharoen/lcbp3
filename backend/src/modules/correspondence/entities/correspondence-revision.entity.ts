// File: src/modules/correspondence/entities/correspondence-revision.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Correspondence } from './correspondence.entity';
import { CorrespondenceStatus } from './correspondence-status.entity';
import { User } from '../../user/entities/user.entity';

@Entity('correspondence_revisions')
// ✅ เพิ่ม Index สำหรับ Virtual Columns เพื่อให้ Search เร็วขึ้น
@Index('idx_corr_rev_v_project', ['vRefProjectId'])
@Index('idx_corr_rev_v_type', ['vRefType'])
export class CorrespondenceRevision {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'correspondence_id' })
  correspondenceId!: number;

  @Column({ name: 'revision_number' })
  revisionNumber!: number; // 0, 1, 2...

  @Column({ name: 'revision_label', nullable: true, length: 10 })
  revisionLabel?: string; // A, B, 001...

  @Column({ name: 'is_current', default: false })
  isCurrent!: boolean;

  @Column({ name: 'correspondence_status_id' })
  statusId!: number;

  @Column({ length: 500 })
  subject!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  body?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'json', nullable: true })
  details?: any; // เก็บข้อมูลแบบ Dynamic ตาม Type

  @Column({ name: 'schema_version', default: 1 })
  schemaVersion!: number;

  // ✅ [New] Virtual Column: ดึง Project ID จาก JSON details
  @Column({
    name: 'v_ref_project_id',
    type: 'int',
    generatedType: 'VIRTUAL',
    asExpression: "JSON_UNQUOTE(JSON_EXTRACT(details, '$.projectId'))",
    nullable: true,
  })
  vRefProjectId?: number;

  // ✅ [New] Virtual Column: ดึง Document SubType จาก JSON details
  @Column({
    name: 'v_doc_subtype',
    type: 'varchar',
    length: 50,
    generatedType: 'VIRTUAL',
    asExpression: "JSON_UNQUOTE(JSON_EXTRACT(details, '$.subType'))",
    nullable: true,
  })
  vRefType?: string;

  // Dates
  @Column({ name: 'document_date', type: 'date', nullable: true })
  documentDate?: Date;

  @Column({ name: 'issued_date', type: 'datetime', nullable: true })
  issuedDate?: Date;

  @Column({ name: 'received_date', type: 'datetime', nullable: true })
  receivedDate?: Date;

  @Column({ name: 'due_date', type: 'datetime', nullable: true })
  dueDate?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'created_by', nullable: true })
  createdBy?: number;

  // Relations
  @ManyToOne(() => Correspondence, (corr) => corr.revisions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'correspondence_id' })
  correspondence?: Correspondence;

  @ManyToOne(() => CorrespondenceStatus)
  @JoinColumn({ name: 'correspondence_status_id' })
  status?: CorrespondenceStatus;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator?: User;
}
