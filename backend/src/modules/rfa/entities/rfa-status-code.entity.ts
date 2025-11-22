import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rfa_status_codes')
export class RfaStatusCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'status_code', length: 20, unique: true })
  statusCode!: string;

  @Column({ name: 'status_name', length: 100 })
  statusName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
