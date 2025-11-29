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
  ACTIVE = 'ACTIVE', // กำลังดำเนินการ
  COMPLETED = 'COMPLETED', // จบกระบวนการ (ถึง Terminal State)
  CANCELLED = 'CANCELLED', // ถูกยกเลิกกลางคัน
  TERMINATED = 'TERMINATED', // ถูกบังคับจบโดยระบบ หรือ Error
}

/**
 * เก็บสถานะการเดินเรื่องของเอกสารแต่ละใบ (Runtime State)
 */
@Entity('workflow_instances')
@Index(['entityType', 'entityId']) // เพื่อค้นหาว่าเอกสารนี้ (เช่น RFA-001) อยู่ขั้นตอนไหน
@Index(['currentState']) // เพื่อ Dashboard: "มีงานค้างที่ขั้นตอนไหนบ้าง"
export class WorkflowInstance {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // ผูกกับ Definition เพื่อรู้ว่าใช้กฎชุดไหน (Version ไหน)
  @ManyToOne(() => WorkflowDefinition)
  @JoinColumn({ name: 'definition_id' })
  definition!: WorkflowDefinition;

  @Column({ name: 'definition_id' })
  definitionId!: string;

  // Polymorphic Relation: เชื่อมกับเอกสารได้หลายประเภท (RFA, CORR, etc.) โดยไม่ต้อง Foreign Key จริง
  @Column({
    name: 'entity_type',
    length: 50,
    comment: 'ประเภทเอกสาร เช่น rfa, correspondence',
  })
  entityType!: string;

  @Column({
    name: 'entity_id',
    length: 50,
    comment: 'ID ของเอกสาร (String/UUID)',
  })
  entityId!: string;

  @Column({
    name: 'current_state',
    length: 50,
    comment: 'ชื่อ State ปัจจุบัน เช่น DRAFT, IN_REVIEW',
  })
  currentState!: string;

  @Column({
    type: 'enum',
    enum: WorkflowStatus,
    default: WorkflowStatus.ACTIVE,
    comment: 'สถานะภาพรวมของ Instance',
  })
  status!: WorkflowStatus;

  // Context: เก็บตัวแปรที่จำเป็นสำหรับการตัดสินใจใน Workflow
  // เช่น { "amount": 500000, "requester_role": "ENGINEER", "approver_ids": [1, 2] }
  @Column({ type: 'json', nullable: true, comment: 'Runtime Context Data' })
  context?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
