import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne, // <--- เพิ่มตรงนี้
  JoinColumn, // <--- เพิ่มตรงนี้
} from 'typeorm';
import { Organization } from '../../project/entities/organization.entity.js'; // อย่าลืม import Organization

@Entity('users')
export class User {
  @PrimaryGeneratedColumn({ name: 'user_id' })
  user_id!: number;

  @Column({ unique: true, length: 50 })
  username!: string;

  @Column({ name: 'password_hash' })
  password!: string;

  @Column({ unique: true, length: 100 })
  email!: string;

  @Column({ name: 'first_name', nullable: true, length: 50 })
  firstName?: string;

  @Column({ name: 'last_name', nullable: true, length: 50 })
  lastName?: string;

  @Column({ name: 'is_active', default: true })
  isActive!: boolean;

  // Relation กับ Organization
  @Column({ name: 'primary_organization_id', nullable: true })
  primaryOrganizationId?: number;

  @ManyToOne(() => Organization)
  @JoinColumn({ name: 'primary_organization_id' })
  organization?: Organization;

  // Base Entity Fields (ที่เราแยกมาเขียนเองเพราะเรื่อง deleted_at)
  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', select: false })
  deletedAt?: Date;
}
