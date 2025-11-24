import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('permissions')
export class Permission {
  @PrimaryGeneratedColumn({ name: 'permission_id' })
  permissionId!: number;

  @Column({ name: 'permission_name', length: 100, unique: true })
  permissionName!: string; // e.g., 'rfa.create'

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 50, nullable: true })
  module?: string; // e.g., 'rfa', 'user'

  @Column({
    name: 'scope_level',
    type: 'enum',
    enum: ['GLOBAL', 'ORG', 'PROJECT'],
    nullable: true,
  })
  scopeLevel?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;
}
