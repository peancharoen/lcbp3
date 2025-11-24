// File: src/modules/workflow-engine/entities/workflow-definition.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('workflow_definitions')
@Index(['workflow_code', 'is_active', 'version'])
export class WorkflowDefinition {
  @PrimaryGeneratedColumn('uuid')
  id!: string; // เพิ่ม !

  @Column({ length: 50, comment: 'รหัส Workflow เช่น RFA, CORR' })
  workflow_code!: string; // เพิ่ม !

  @Column({ type: 'int', default: 1, comment: 'หมายเลข Version' })
  version!: number; // เพิ่ม !

  @Column({ type: 'json', comment: 'นิยาม Workflow ต้นฉบับ' })
  dsl!: any; // เพิ่ม !

  @Column({ type: 'json', comment: 'โครงสร้างที่ Compile แล้ว' })
  compiled!: any; // เพิ่ม !

  @Column({ default: true, comment: 'สถานะการใช้งาน' })
  is_active!: boolean; // เพิ่ม !

  @CreateDateColumn()
  created_at!: Date; // เพิ่ม !

  @UpdateDateColumn()
  updated_at!: Date; // เพิ่ม !
}
