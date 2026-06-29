import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('circulation_status_codes')
export class CirculationStatusCode {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 20, unique: true })
  code!: string;

  @Column({ length: 50 })
  description!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
