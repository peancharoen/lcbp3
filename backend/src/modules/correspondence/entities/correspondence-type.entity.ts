import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('correspondence_types')
export class CorrespondenceType {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'type_code', unique: true, length: 50 })
  typeCode!: string; // เช่น RFA, RFI, LETTER

  @Column({ name: 'type_name', length: 255 })
  typeName!: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', default: true, type: 'tinyint' })
  isActive!: boolean;
}
