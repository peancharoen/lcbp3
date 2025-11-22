import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('rfa_types')
export class RfaType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'type_code', length: 20, unique: true })
  typeCode!: string;

  @Column({ name: 'type_name', length: 100 })
  typeName!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
