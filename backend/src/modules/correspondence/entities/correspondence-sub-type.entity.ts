// File: src/modules/master/entities/correspondence-sub-type.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Contract } from '../../contract/entities/contract.entity'; // ปรับ path ตามจริง
import { CorrespondenceType } from './correspondence-type.entity'; // ปรับ path ตามจริง

@Entity('correspondence_sub_types')
export class CorrespondenceSubType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'contract_id' })
  contractId!: number;

  @Column({ name: 'correspondence_type_id' })
  correspondenceTypeId!: number;

  @Column({ name: 'sub_type_code', length: 20 })
  subTypeCode!: string; // เช่น MAT, SHP

  @Column({ name: 'sub_type_name', nullable: true })
  subTypeName?: string;

  @Column({ name: 'sub_type_number', length: 10, nullable: true })
  subTypeNumber?: string; // เลขรหัสสำหรับ Running Number (เช่น 11, 22)

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  // Relations
  @ManyToOne(() => Contract)
  @JoinColumn({ name: 'contract_id' })
  contract?: Contract;

  @ManyToOne(() => CorrespondenceType)
  @JoinColumn({ name: 'correspondence_type_id' })
  correspondenceType?: CorrespondenceType;
}
