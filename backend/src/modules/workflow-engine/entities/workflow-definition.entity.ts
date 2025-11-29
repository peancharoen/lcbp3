// File: src/modules/workflow-engine/entities/workflow-definition.entity.ts

import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * เก็บแม่แบบ (Blueprint) ของ Workflow
 * 1 Workflow Code (เช่น RFA) สามารถมีได้หลาย Version
 */
@Entity('workflow_definitions')
@Unique(['workflow_code', 'version']) // ป้องกัน Version ซ้ำใน Workflow เดียวกัน
@Index(['workflow_code', 'is_active', 'version']) // เพื่อการ Query หา Active Version ล่าสุดได้เร็ว
export class WorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 50, comment: 'รหัส Workflow เช่น RFA, CORR, LEAVE_REQ' })
  workflow_code!: string;

  @Column({
    type: 'int',
    default: 1,
    comment: 'หมายเลข Version (Running sequence)',
  })
  version!: number;

  @Column({ type: 'text', nullable: true, comment: 'คำอธิบายเพิ่มเติม' })
  description?: string;

  @Column({
    type: 'json',
    comment: 'Raw DSL ที่ User/Admin เขียน (เก็บไว้เพื่อดูหรือแก้ไข)',
  })
  dsl!: any; // ควรตรงกับ RawWorkflowDSL interface

  @Column({
    type: 'json',
    comment:
      'Compiled JSON Structure ที่ผ่านการ Validate และ Optimize สำหรับ Runtime Engine แล้ว',
  })
  compiled!: any; // ควรตรงกับ CompiledWorkflow interface

  @Column({ default: true, comment: 'สถานะการใช้งาน (Soft Disable)' })
  is_active!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at!: Date;
}
