import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rfa_approve_codes')
export class RfaApproveCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'approve_code', length: 20, unique: true })
  approveCode!: string;

  @Column({ name: 'approve_name', length: 100 })
  approveName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
