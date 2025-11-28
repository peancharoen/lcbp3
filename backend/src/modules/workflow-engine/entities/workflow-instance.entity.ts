// File: src/modules/workflow-engine/entities/workflow-instance.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { WorkflowDefinition } from './workflow-definition.entity';

export enum WorkflowStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  TERMINATED = 'TERMINATED',
}

@Entity('workflow_instances')
@Index(['entityType', 'entityId']) // Index สำหรับค้นหาตามเอกสาร
@Index(['currentState']) // Index สำหรับ Filter ตามสถานะ
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // เชื่อมโยงกับ Definition ที่ใช้ตอนสร้าง Instance นี้
  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'definition_id' })
  definition!: WorkflowDefinition;

  @Column({ name: 'definition_id' })
  definitionId!: string;

  // Polymorphic Relation: เชื่อมกับเอกสารได้หลายประเภท (RFA, CORR, etc.)
  @Column({ name: 'entity_type', length: 50 })
  entityType!: string;

  @Column({ name: 'entity_id', length: 50 })
  entityId!: string; // รองรับทั้ง ID แบบ Int และ UUID (เก็บเป็น String)

  @Column({ name: 'current_state', length: 50 })
  currentState!: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.ACTIVE,
  })
  status!: WorkflowStatus;

  // Context เฉพาะของ Instance นี้ (เช่น ตัวแปรที่ส่งต่อระหว่าง State)
  @Column({ type: 'json', nullable: true })
  context?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
