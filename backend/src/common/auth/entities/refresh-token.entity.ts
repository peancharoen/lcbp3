// File: backend/src/common/auth/entities/refresh-token.entity.ts
// Change Log:
// - 2026-08-18: เพิ่ม device_name, ip_address, user_agent, last_active_at สำหรับ session tracking

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../../modules/user/entities/user.entity';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn({ name: 'token_id' })
  tokenId!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ name: 'token_hash', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expires_at' })
  expiresAt!: Date;

  @Column({ name: 'is_revoked', default: false })
  isRevoked!: boolean;

  @Column({ name: 'device_name', nullable: true, length: 255, type: 'varchar' })
  deviceName?: string | null;

  @Column({ name: 'ip_address', nullable: true, length: 45, type: 'varchar' })
  ipAddress?: string | null;

  @Column({ name: 'user_agent', nullable: true, length: 512, type: 'varchar' })
  userAgent?: string | null;

  @Column({ name: 'last_active_at', nullable: true, type: 'datetime' })
  lastActiveAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'replaced_by_token', nullable: true, length: 255 })
  replacedByToken?: string; // For rotation support

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
