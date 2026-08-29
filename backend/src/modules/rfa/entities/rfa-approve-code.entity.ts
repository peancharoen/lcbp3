import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * Master table for RFA approval result codes
 * ADR-049: scheme ใหม่ (1=Approved, 2=Approved with Comments, 3=Revise and Resubmit, 4=Rejected)
 * code เดิม (1A/1C/1N/1R/3C/3R/4X/5N) ปิด is_active=0 แล้ว — ใช้สำหรับ preserve audit history
 */
@Entity('rfa_approve_codes')
export class RfaApproveCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    name: 'approve_code',
    length: 20,
    unique: true,
    comment: 'ADR-049 scheme: 1/2/3/4',
  })
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
