// File: src/modules/workflow-engine/entities/workflow-history.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Attachment } from '../../../common/file-storage/entities/attachment.entity';
import { WorkflowInstance } from './workflow-instance.entity';

/**
 * เก็บประวัติการเปลี่ยนสถานะ (Audit Trail)
 * สำคัญมากสำหรับการตรวจสอบย้อนหลัง (Who did What, When)
 */
@Entity('workflow_histories')
@Index(['instanceId']) // ค้นหาประวัติของ Instance นี้
@Index(['actionByUserId']) // ค้นหาว่า User คนนี้ทำอะไรไปบ้าง
export class WorkflowHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => WorkflowInstance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance!: WorkflowInstance;

  @Column({ name: 'instance_id' })
  instanceId!: string;

  @Column({ name: 'from_state', length: 50, comment: 'สถานะต้นทาง' })
  fromState!: string;

  @Column({ name: 'to_state', length: 50, comment: 'สถานะปลายทาง' })
  toState!: string;

  @Column({ length: 50, comment: 'Action ที่ User กด (เช่น APPROVE, REJECT)' })
  action!: string;

  @Column({
    name: 'action_by_user_id',
    nullable: true,
    comment: 'User ID ผู้ดำเนินการ (Nullable กรณี System Auto)',
  })
  actionByUserId?: number;

  // ADR-019: UUID ของ User ผู้ดำเนินการ — expose ใน API Response แทน INT PK
  // NULL = System Action หรือ Pre-migration record (Delta 10)
  @Column({
    name: 'action_by_user_uuid',
    length: 36,
    nullable: true,
    comment:
      'UUID ของ User ผู้ดำเนินการ — ใช้ใน API Response per ADR-019. INT FK action_by_user_id ยังคงอยู่สำหรับ Internal use',
  })
  actionByUserUuid?: string;

  @Column({ type: 'text', nullable: true, comment: 'ความเห็นประกอบการอนุมัติ' })
  comment?: string;

  // Snapshot ข้อมูล ณ เวลาที่เปลี่ยนสถานะ เพื่อเป็นหลักฐานหาก Context เปลี่ยนในอนาคต
  @Column({
    type: 'json',
    nullable: true,
    comment: 'Snapshot of Context or Metadata',
  })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // ADR-021: ไฟล์แนบที่อัปโหลดพร้อมขั้นตอนนี้ — Lazy โหลดเฉพาะเมื่อต้องการ (ป้องกัน N+1)
  @OneToMany(
    () => Attachment,
    (attachment: Attachment) => attachment.workflowHistory,
    { lazy: true }
  )
  attachments?: Promise<Attachment[]>;
}
