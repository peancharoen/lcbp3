import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('correspondence_status')
export class CorrespondenceStatus {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'status_code', unique: true, length: 50 })
  statusCode!: string; // เช่น DRAFT, SUBOWN

  @Column({ name: 'status_name', length: 255 })
  statusName!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true, type: 'tinyint' })
  isActive!: boolean;
}
