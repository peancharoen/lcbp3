import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  PrimaryColumn, // ✅ [Fix] เพิ่ม Import นี้
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum NotificationType {
  EMAIL = 'EMAIL',
  LINE = 'LINE',
  SYSTEM = 'SYSTEM',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'user_id' })
  userId!: number;

  @Column({ length: 255 })
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({
    name: 'notification_type',
    type: 'enum',
    enum: NotificationType,
  })
  notificationType!: NotificationType;

  @Column({ name: 'is_read', default: false })
  isRead!: boolean;

  @Column({ name: 'entity_type', length: 50, nullable: true })
  entityType?: string; // e.g., 'rfa', 'circulation', 'correspondence'

  @Column({ name: 'entity_id', nullable: true })
  entityId?: number;

  // ✅ [Fix] รวม Decorator ไว้ที่นี่ที่เดียว (เป็นทั้ง CreateDate และ PrimaryColumn สำหรับ Partition)
  @CreateDateColumn({ name: 'created_at' })
  @PrimaryColumn()
  createdAt!: Date;

  // --- Relations ---

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
