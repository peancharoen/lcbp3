// File: src/modules/master/entities/discipline.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity'; // ปรับ path ตามจริง

@Entity('disciplines')
@Unique(['contractId', 'disciplineCode']) // ป้องกันรหัสซ้ำในสัญญาเดียวกัน
export class Discipline {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contract_id' })
  contractId!: number;

  @Column({ name: 'discipline_code', length: 10 })
  disciplineCode!: string; // เช่น GEN, STR, ARC

  @Column({ name: 'code_name_th', nullable: true })
  codeNameTh?: string;

  @Column({ name: 'code_name_en', nullable: true })
  codeNameEn?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;
}
