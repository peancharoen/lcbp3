import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
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

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'replaced_by_token', nullable: true, length: 255 })
  replacedByToken?: string; // For rotation support

  // Relations
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;
}
