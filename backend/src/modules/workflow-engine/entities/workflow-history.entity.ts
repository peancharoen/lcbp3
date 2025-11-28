// File: src/modules/workflow-engine/entities/workflow-history.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkflowInstance } from './workflow-instance.entity';

@Entity('workflow_histories')
export class WorkflowHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => WorkflowInstance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'instance_id' })
  instance!: WorkflowInstance;

  @Column({ name: 'instance_id' })
  instanceId!: string;

  @Column({ name: 'from_state', length: 50 })
  fromState!: string;

  @Column({ name: 'to_state', length: 50 })
  toState!: string;

  @Column({ length: 50 })
  action!: string;

  @Column({ name: 'action_by_user_id', nullable: true })
  actionByUserId?: number; // User ID ของผู้ดำเนินการ

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: Record<string, any>; // เก็บข้อมูลเพิ่มเติม เช่น Snapshot ของ Context ณ ตอนนั้น

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
