import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { WorkflowHistory } from '../../../modules/workflow-engine/entities/workflow-history.entity';
import { User } from '../../../modules/user/entities/user.entity';
import { UuidBaseEntity } from '../../entities/uuid-base.entity';
import { Exclude } from 'class-transformer';

@Entity('attachments')
export class Attachment extends UuidBaseEntity {
  @PrimaryGeneratedColumn()
  @Exclude()
  id!: number;

  @Column({ name: 'original_filename', length: 255 })
  originalFilename!: string;

  @Column({ name: 'stored_filename', length: 255 })
  storedFilename!: string;

  @Column({ name: 'file_path', length: 500 })
  filePath!: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType!: string;

  @Column({ name: 'file_size' })
  fileSize!: number;

  @Column({ name: 'is_temporary', default: true })
  isTemporary!: boolean;

  @Column({ name: 'temp_id', length: 100, nullable: true })
  tempId?: string;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt?: Date;

  @Column({ length: 64, nullable: true })
  checksum?: string;

  @Column({ name: 'reference_date', type: 'date', nullable: true })
  referenceDate?: Date;

  // ADR-021: FK ไปยัง workflow_histories สำหรับไฟล์แนบประจำ Step
  // NULL = ไฟล์แนบหลัก (Main Document), NOT NULL = ไฟล์ประจำ Workflow Step
  @Column({ name: 'workflow_history_id', nullable: true })
  workflowHistoryId?: string;

  // Lazy relation — ไม่ include ใน default query เพื่อป้องกัน N+1
  @ManyToOne(
    () => WorkflowHistory,
    (history: WorkflowHistory) => history.attachments,
    { nullable: true, onDelete: 'SET NULL', lazy: true }
  )
  @JoinColumn({ name: 'workflow_history_id' })
  workflowHistory?: Promise<WorkflowHistory>;

  @Column({ name: 'uploaded_by_user_id' })
  uploadedByUserId!: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relation กับ User (คนอัปโหลด)
  @ManyToOne(() => User)
  @JoinColumn({ name: 'uploaded_by_user_id' })
  uploadedBy?: User;
}
